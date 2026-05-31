import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { z } from 'zod';
import { genAI } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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

        if (!combinedInterests) {
            return NextResponse.json({ status: "No user interests found to generate queries." }, { status: 200 });
        }

        // 2. Initialize Vercel AI SDK with Groq
        const groq = createGroq({
            apiKey: process.env.GROQ_API_KEY,
        });

        // 3. Define the Zod schema for NewsQueries (validation)
        const NewsQueriesSchema = z.object({
            queries: z.array(z.string().max(200)).max(15)
        });

        // 4. Generate the optimized Boolean search queries using generateText 
        // since llama-3.1-8b-instant does not support structured output schemas natively.
        const { text } = await generateText({
            model: groq('llama-3.1-8b-instant'),
            system: `You are a News Director. Your task is to read the combined user interests provided and group them into a maximum of 15 highly optimized Boolean search queries using the OR operator (e.g., "Quantum Computing" OR "Artificial Intelligence").
            Ensure that no individual query string exceeds 200 characters in length. Do not include unnecessary filler words. Focus purely on the key entities, technologies, or subjects mentioned in the interests.
            
            IMPORTANT: You MUST respond ONLY with a valid JSON object matching this exact schema:
            {
              "queries": ["query 1", "query 2"]
            }
            Do not include any other text or markdown formatting.`,
            prompt: `Here are the combined user interests:\n\n${combinedInterests}`,
        });

        // 5. Parse and validate the response
        let parsedData;
        try {
            // Strip potential markdown code blocks if the model incorrectly adds them
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            parsedData = JSON.parse(cleanText);
        } catch (e) {
            throw new Error('Model failed to return valid JSON: ' + text);
        }

        const validatedObject = NewsQueriesSchema.parse(parsedData);

        console.log("Generated News Queries:", validatedObject.queries);

        // 6. GNews API Integration
        const apiKey = process.env.GNEWS_API_KEY;
        if (!apiKey) {
            throw new Error("GNEWS_API_KEY environment variable is not defined.");
        }

        const allRawArticles: any[] = [];

        // --- Macro Core (Top Headlines) ---
        console.log("Fetching Macro Core (Top Headlines)...");
        const topHeadlinesUrls = [
            `https://gnews.io/api/v4/top-headlines?category=world&lang=en&apikey=${apiKey}`,
            `https://gnews.io/api/v4/top-headlines?category=nation&country=in&lang=en&apikey=${apiKey}`
        ];

        try {
            const headlinesResponses = await Promise.all(
                topHeadlinesUrls.map(url => fetch(url).then(res => res.json()))
            );

            for (let i = 0; i < headlinesResponses.length; i++) {
                const data = headlinesResponses[i];
                const country = i === 1 ? "in" : null;
                if (data && Array.isArray(data.articles)) {
                    const articlesWithCountry = data.articles.map((a: any) => ({ ...a, source_country: country }));
                    allRawArticles.push(...articlesWithCountry);
                } else if (data && data.errors) {
                    console.error("GNews Headlines API error:", data.errors);
                }
            }
        } catch (err) {
            console.error("Failed fetching top headlines:", err);
        }

        // --- Micro Tail (Search Queries) ---
        console.log("Fetching Micro Tail (Search Queries)...");
        try {
            const searchPromises = validatedObject.queries.map(async (query) => {
                const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=10&sortby=relevance&apikey=${apiKey}`;
                const res = await fetch(url);
                const data = await res.json();
                return data;
            });

            const searchResponses = await Promise.all(searchPromises);

            for (const data of searchResponses) {
                if (data && Array.isArray(data.articles)) {
                    allRawArticles.push(...data.articles);
                } else if (data && data.errors) {
                    console.error("GNews Search API error:", data.errors);
                }
            }
        } catch (err) {
            console.error("Failed fetching search queries:", err);
        }

        // --- Data Cleaning (Deduplication based on URL) ---
        const seenUrls = new Set<string>();
        const deduplicatedArticles = allRawArticles.filter(article => {
            if (!article.url) return false;
            if (seenUrls.has(article.url)) {
                return false;
            }
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
                        source_domain: article.source?.name || "",
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

        return NextResponse.json({ 
            status: "Success",
            queries: validatedObject.queries,
            totalRawCount: allRawArticles.length,
            deduplicatedCount: deduplicatedArticles.length,
            trulyNewCount: trulyNewArticles.length,
            insertedCount: insertedCount
        }, { status: 200 });

    } catch (error: any) {
        console.error("Cron Ingest News Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
