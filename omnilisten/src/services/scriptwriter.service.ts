import { supabaseServer } from '@/lib/supabase';
import { SCRIPTWRITER_SYSTEM_PROMPT } from '@/lib/gemini';
import { generateTextContent } from '@/services/ai-provider.service';

const LANGUAGE_NAME_MAP: Record<string, string> = {
    hi: 'Hindi (हिन्दी) in Devanagari script',
    ta: 'Tamil (தமிழ்) in Tamil script',
    te: 'Telugu (తెలుగు) in Telugu script',
    bn: 'Bengali (বাংলা) in Bengali script',
    mr: 'Marathi (मराठी) in Devanagari script',
    gu: 'Gujarati (<ctrl42>ગુજરાતી) in Gujarati script',
    kn: 'Kannada (ಕನ್ನಡ) in Kannada script',
    ml: 'Malayalam (മലയാളം) in Malayalam script',
    pa: 'Punjabi (ਪੰਜਾਬੀ) in Gurmukhi script',
    en: 'English'
};

/**
 * Fetches the user's personal interest embedding vector and preferred language from Supabase.
 */
export async function getUserInterestVectorAndLanguage(userId: string): Promise<{ vector: number[]; language: string }> {
    const { data: profileData, error } = await supabaseServer
        .from('profiles')
        .select('interest_vector, preferred_language')
        .eq('id', userId)
        .single();

    if (error || !profileData?.interest_vector) {
        console.error("Profile fetch error:", error);
        const customError: any = new Error('Failed to fetch user interest vector or vector is empty');
        customError.status = 404;
        throw customError;
    }

    return {
        vector: profileData.interest_vector,
        language: profileData.preferred_language || 'en'
    };
}

/**
 * Legacy wrapper for backward compatibility.
 */
export async function getUserInterestVector(userId: string): Promise<number[]> {
    const { vector } = await getUserInterestVectorAndLanguage(userId);
    return vector;
}

/**
 * Senior Architect Recency-Weighted & Bookmarked Vector Search:
 * Retrieves news articles using vector similarity combined with exponential time-decay scoring,
 * while strictly excluding any articles previously consumed by the user in recent playlists
 * and enforcing a strict 72-hour publishing recency window.
 */
export async function getRelevantArticles(interestVector: number[], userId?: string): Promise<any[]> {
    const usedArticleIds = new Set<number>();

    // 1. Fetch user's previous article_ids from daily_playlists (last 7 days)
    if (userId) {
        try {
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data: pastPlaylists } = await supabaseServer
                .from('daily_playlists')
                .select('article_ids')
                .eq('user_id', userId)
                .gte('created_at', sevenDaysAgo);

            if (pastPlaylists) {
                for (const p of pastPlaylists) {
                    if (Array.isArray(p.article_ids)) {
                        p.article_ids.forEach((id: number) => usedArticleIds.add(Number(id)));
                    }
                }
            }
            console.log(`[Deduplication Filter 🛡️] User ${userId} has consumed ${usedArticleIds.size} article(s) in past 7 days.`);
        } catch (err) {
            console.warn("Failed to fetch past article_ids for deduplication:", err);
        }
    }

    // 2. Perform vector search matching with initial threshold
    let { data: articles, error } = await supabaseServer
        .rpc('match_news_articles', {
            query_embedding: interestVector,
            match_threshold: 0.20,
            match_count: 50
        });

    const now = Date.now();
    const threeDaysAgoMs = now - (72 * 60 * 60 * 1000); // 72-hour primary recency window
    const sevenDaysAgoMs = now - (7 * 24 * 60 * 60 * 1000); // 7-day fallback window

    // Helper: Filter unread articles within given time window
    const filterFreshArticles = (rawArticles: any[], minTimeMs: number = threeDaysAgoMs) => {
        return rawArticles.filter((article: any) => {
            const isUsed = usedArticleIds.has(Number(article.id));
            const pubDate = article.published_at ? new Date(article.published_at).getTime() : now;
            const isRecent = pubDate >= minTimeMs;
            return !isUsed && isRecent;
        });
    };

    let freshArticles = (articles && articles.length > 0) ? filterFreshArticles(articles) : [];

    // Fallback 1: If threshold 0.20 yielded < 2 fresh articles, relax similarity threshold to -1.0
    if (freshArticles.length < 2) {
        console.log(`[Recency Fallback 🔄] Threshold 0.20 yielded ${freshArticles.length} fresh articles. Relaxing match_threshold to -1.0...`);
        const { data: fallbackArticles } = await supabaseServer
            .rpc('match_news_articles', {
                query_embedding: interestVector,
                match_threshold: -1.0,
                match_count: 50
            });

        if (fallbackArticles && fallbackArticles.length > 0) {
            freshArticles = filterFreshArticles(fallbackArticles);
            articles = fallbackArticles;
        }
    }

    // Fallback 2: Direct Database Table Query for latest unread articles (checking newest articles by id/published_at)
    if (freshArticles.length < 2) {
        console.log(`[Direct DB Fallback 📥] Vector search yielded ${freshArticles.length} fresh articles. Fetching latest unread articles directly from articles table...`);
        const { data: dbLatestArticles } = await supabaseServer
            .from('articles')
            .select('id, title, content, published_at, source_domain')
            .order('id', { ascending: false })
            .limit(50);

        if (dbLatestArticles && dbLatestArticles.length > 0) {
            freshArticles = filterFreshArticles(dbLatestArticles, threeDaysAgoMs);
            if (freshArticles.length < 2) {
                // Extended 7-day window fallback if 72h window is sparse
                freshArticles = filterFreshArticles(dbLatestArticles, sevenDaysAgoMs);
            }
            articles = dbLatestArticles;
        }
    }

    // Fallback 3: Extended 7-day window check on initial vector search results if still < 2 articles
    if (freshArticles.length < 2 && articles && articles.length > 0) {
        console.log(`[Extended Window Fallback ⏰] Expanding recency window to 7 days for vector matches...`);
        freshArticles = filterFreshArticles(articles, sevenDaysAgoMs);
    }

    // Final Failsafe: If total DB contains 0 articles within window, skip safely
    if (freshArticles.length < 2) {
        console.log(`[Freshness Guard 🛑] User ${userId} has zero available unread articles in database. Skipping briefing creation.`);
        return [];
    }

    // Application-Level Fallback: Enrich articles with published_at if missing
    const missingPubDateIds = freshArticles.filter((a: any) => !a.published_at).map((a: any) => Number(a.id)).filter(Boolean);
    if (missingPubDateIds.length > 0) {
        try {
            const { data: dbArticles } = await supabaseServer
                .from('articles')
                .select('id, published_at')
                .in('id', missingPubDateIds);

            if (dbArticles) {
                const pubDateMap = new Map(dbArticles.map(a => [Number(a.id), a.published_at]));
                freshArticles.forEach((a: any) => {
                    if (!a.published_at && pubDateMap.has(Number(a.id))) {
                        a.published_at = pubDateMap.get(Number(a.id));
                    }
                });
            }
        } catch (enrichErr) {
            console.warn("Failed to enrich article published_at dates:", enrichErr);
        }
    }

    const candidateArticles = freshArticles;

    const scoredArticles = candidateArticles.map((article: any) => {
        const publishedDate = article.published_at ? new Date(article.published_at).getTime() : now;
        const ageInDays = Math.max(0, (now - publishedDate) / (1000 * 60 * 60 * 24));
        const recencyWeight = Math.exp(-0.1 * ageInDays); // Stronger time decay
        const rawSimilarity = article.similarity || 0.5;
        
        return {
            ...article,
            recency_score: rawSimilarity * recencyWeight
        };
    });

    // Sort by recency-weighted score descending and pick top 5
    scoredArticles.sort((a: any, b: any) => b.recency_score - a.recency_score);
    return scoredArticles.slice(0, 5);
}

/**
 * Processes articles into a structured context string and prompts Groq LLaMA for a podcast script
 * in the user's preferred target language and script.
 */
export async function generatePodcastScript(articles: any[], targetLanguage: string = 'en'): Promise<string> {
    const contextString = articles.map((article: any, index: number) => {
        return `### Story ${index + 1}\nTitle: ${article.title}\nContent:\n${article.content}`;
    }).join('\n\n---\n\n');

    const targetLangName = LANGUAGE_NAME_MAP[targetLanguage] || 'English';

    const prompt = `Here are the top personalized news stories to discuss in today's podcast. Please process them into our script format:

${contextString}

CRITICAL INSTRUCTIONS FOR AUDIO SYNTHESIS:
1. You are an on-demand spoken word podcaster. 
2. Rewrite these news articles into a single, cohesive 3-minute podcast script. 
3. TARGET LANGUAGE: Write the ENTIRE podcast script natively in ${targetLangName}. 
4. Speak in a natural, conversational tone, as if you are talking to someone walking outdoors.
5. Keep sentences short and varied, and avoid lists and rigid explanations.
6. DO NOT output any markdown, asterisks, bolding, or special characters.
7. DO NOT include speaker labels (like "Host:") or stage directions (like "(Intro music fades in)"). 
8. Generate ONLY the exact words in ${targetLangName} that should be spoken out loud by the voice engine.`;

    return await generateTextContent({
        prompt,
        systemInstruction: SCRIPTWRITER_SYSTEM_PROMPT
    });
}
