import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { genAI } from '@/lib/gemini';
import { fetchTopHackerNewsArticles } from '@/services/hackernews.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const startTime = Date.now();
    try {
        const authHeader = request.headers.get('authorization');
        
        // Vercel secures cron jobs via 'Bearer <CRON_SECRET>' pattern
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized calling cron identity' }, { status: 401 });
        }

        // 1. Select all non-null interest_summary from the profiles table
        const { data: profiles, error: profileError } = await supabaseServer
            .from('profiles')
            .select('interest_summary')
            .not('interest_summary', 'is', null);

        if (profileError) {
            console.error('Failed to fetch user profiles for news ingest:', profileError);
            throw new Error('Supabase Profile Fetch Error');
        }

        // Combine them into a single string
        const combinedInterests = profiles
            .map(p => p.interest_summary)
            .filter(Boolean)
            .join('\n');

        const allRawArticles: any[] = [];

        // 2. Parallel Ingestion: Fetch Hacker News Top Stories (100% Free Open API)
        const hnPromise = fetchTopHackerNewsArticles(25).then(hnArticles => {
            hnArticles.forEach(a => {
                allRawArticles.push({
                    title: a.title,
                    description: a.content,
                    content: a.content,
                    url: a.url,
                    publishedAt: a.published_at,
                    source: { name: a.source_domain },
                    source_country: null
                });
            });
        }).catch(err => console.warn("Hacker News ingestion warning:", err));

        // 3. GNews API Integration (if interests exist)
        let generatedQueries: string[] = [];
        const apiKey = process.env.GNEWS_API_KEY;

        const gnewsPromise = (async () => {
            if (!combinedInterests || !apiKey) return;

            try {
                const NewsQueriesSchema = z.object({
                    queries: z.array(z.string().max(200)).max(15)
                });

                const systemPrompt = `You are a News Director. Your task is to read the combined user interests provided and group them into a maximum of 15 highly optimized Boolean search queries using the OR operator (e.g., "Quantum Computing" OR "Artificial Intelligence").
Ensure that no individual query string exceeds 200 characters in length. Do not include unnecessary filler words. Focus purely on the key entities, technologies, or subjects mentioned in the interests.

IMPORTANT: You MUST respond ONLY with a valid JSON object matching this exact schema:
{
  "queries": ["query 1", "query 2"]
}
Do not include any other text or markdown formatting.`;

                let rawText = "";
                try {
                    const geminiModel = genAI.getGenerativeModel({ 
                        model: "gemini-2.5-flash",
                        systemInstruction: systemPrompt 
                    });
                    const res = await geminiModel.generateContent(`Here are the combined user interests:\n\n${combinedInterests}`);
                    rawText = res.response.text();
                } catch (geminiErr) {
                    console.warn("Gemini query gen fallback to Groq:", geminiErr);
                    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
                    const { text } = await generateText({
                        model: groq('llama-3.3-70b-versatile'),
                        system: systemPrompt,
                        prompt: `Here are the combined user interests:\n\n${combinedInterests}`,
                    });
                    rawText = text;
                }

                const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsedData = JSON.parse(cleanText);
                const validatedObject = NewsQueriesSchema.parse(parsedData);
                generatedQueries = validatedObject.queries;

                // --- Macro Core (Top Headlines) ---
                const topHeadlinesUrls = [
                    `https://gnews.io/api/v4/top-headlines?category=world&lang=en&apikey=${apiKey}`,
                    `https://gnews.io/api/v4/top-headlines?category=nation&country=in&lang=en&apikey=${apiKey}`
                ];

                const headlinesResponses = await Promise.all(
                    topHeadlinesUrls.map(url => fetch(url).then(res => res.json()).catch(() => null))
                );

                for (let i = 0; i < headlinesResponses.length; i++) {
                    const data = headlinesResponses[i];
                    const country = i === 1 ? "in" : null;
                    if (data && Array.isArray(data.articles)) {
                        allRawArticles.push(...data.articles.map((a: any) => ({ ...a, source_country: country })));
                    }
                }

                // --- Micro Tail (Search Queries) ---
                const searchPromises = generatedQueries.map(async (query) => {
                    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=10&sortby=relevance&apikey=${apiKey}`;
                    const res = await fetch(url);
                    return await res.json();
                });

                const searchResponses = await Promise.all(searchPromises);
                for (const data of searchResponses) {
                    if (data && Array.isArray(data.articles)) {
                        allRawArticles.push(...data.articles);
                    }
                }
            } catch (err) {
                console.error("GNews Ingestion Error:", err);
            }
        })();

        // Wait for both GNews and Hacker News ingestion promises to finish
        await Promise.allSettled([hnPromise, gnewsPromise]);

        // --- Data Cleaning (Deduplication based on URL) ---
        const seenUrls = new Set<string>();
        const deduplicatedArticles = allRawArticles.filter(article => {
            if (!article.url) return false;
            if (seenUrls.has(article.url)) return false;
            seenUrls.add(article.url);
            return true;
        });

        console.log(`Deduplication finished. Total raw: ${allRawArticles.length}, Deduplicated: ${deduplicatedArticles.length}`);

        // --- Database Deduplication ---
        const urlArray = deduplicatedArticles.map(a => a.url).filter(Boolean);
        let trulyNewArticles: any[] = [];
        
        if (urlArray.length > 0) {
            const { data: existingArticles, error: fetchError } = await supabaseServer
                .from('articles')
                .select('url')
                .in('url', urlArray);

            if (fetchError) {
                console.error("Error checking existing articles in DB:", fetchError);
                throw fetchError;
            }

            const existingUrls = new Set(existingArticles?.map(a => a.url) || []);
            trulyNewArticles = deduplicatedArticles.filter(a => !existingUrls.has(a.url));
        }

        console.log(`DB Deduplication finished. Truly new articles to ingest: ${trulyNewArticles.length}`);

        // --- Embedding Generation and Insertion ---
        let insertedCount = 0;
        if (trulyNewArticles.length > 0) {
            const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

            const articlesToInsert = await Promise.all(
                trulyNewArticles.map(async (article) => {
                    const combinedText = `Title: ${article.title || ""}\nDescription: ${article.description || ""}\nContent: ${article.content || ""}`;
                    
                    const embedResult = await embeddingModel.embedContent({
                        content: {
                            role: "user",
                            parts: [{ text: combinedText }]
                        },
                        taskType: "RETRIEVAL_DOCUMENT",
                        outputDimensionality: 768
                    } as any);

                    const embeddingVector = embedResult.embedding.values;

                    return {
                        title: article.title || "",
                        content: article.content || article.description || "",
                        url: article.url,
                        source_domain: article.source?.name || "news.ycombinator.com",
                        published_at: article.publishedAt || new Date().toISOString(),
                        article_vector: embeddingVector,
                        source_country: article.source_country || null
                    };
                })
            );

            // Bulk Insert
            const { error: insertError } = await supabaseServer
                .from('articles')
                .insert(articlesToInsert);

            if (insertError) {
                console.error("Failed to bulk insert articles:", insertError);
                throw insertError;
            }

            insertedCount = articlesToInsert.length;
        }

        const executionTimeMs = Date.now() - startTime;
        const resultPayload = {
            status: "Success",
            queries: generatedQueries,
            totalRawCount: allRawArticles.length,
            deduplicatedCount: deduplicatedArticles.length,
            trulyNewCount: trulyNewArticles.length,
            insertedCount: insertedCount
        };

        // Write persistent audit log into Supabase cron_logs table
        try {
            await supabaseServer.from('cron_logs').insert({
                cron_name: 'ingest-news',
                status: 'Success',
                details: resultPayload,
                execution_time_ms: executionTimeMs
            });
        } catch (logErr) {
            console.warn("Failed to write cron_logs entry:", logErr);
        }

        return NextResponse.json(resultPayload, { status: 200 });

    } catch (error: any) {
        const executionTimeMs = Date.now() - startTime;
        console.error("Cron Ingest News Error:", error);

        try {
            await supabaseServer.from('cron_logs').insert({
                cron_name: 'ingest-news',
                status: 'Error',
                details: { error: error.message || "Internal Server Error" },
                execution_time_ms: executionTimeMs
            });
        } catch (logErr) {
            console.warn("Failed to write error to cron_logs:", logErr);
        }

        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
