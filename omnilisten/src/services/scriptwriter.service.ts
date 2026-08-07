import { supabaseServer } from '@/lib/supabase';
import { SCRIPTWRITER_SYSTEM_PROMPT } from '@/lib/gemini';
import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const LANGUAGE_NAME_MAP: Record<string, string> = {
    hi: 'Hindi (हिन्दी) in Devanagari script',
    ta: 'Tamil (தமிழ்) in Tamil script',
    te: 'Telugu (తెలుగు) in Telugu script',
    bn: 'Bengali (বাংলা) in Bengali script',
    mr: 'Marathi (मराठी) in Devanagari script',
    gu: 'Gujarati (ગુજરાતી) in Gujarati script',
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
 * while strictly excluding any articles previously consumed by the user in recent playlists.
 * Applies a Strict Freshness Guard to prevent creating duplicate audiobooks when 0 new articles are ingested.
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

    // 2. Perform vector search matching
    const { data: articles, error } = await supabaseServer
        .rpc('match_news_articles', {
            query_embedding: interestVector,
            match_threshold: 0.30,
            match_count: 25
        });

    if (error || !articles || articles.length === 0) {
        console.error("RPC matching error:", error);
        return [];
    }

    const now = Date.now();

    // 3. Filter out used articles
    const freshArticles = articles.filter((article: any) => !usedArticleIds.has(Number(article.id)));
    
    // Strict Freshness Guard: If deduplication leaves fewer than 2 fresh unread articles for this user,
    // return an empty array to prevent creating duplicate audiobooks with yesterday's news.
    if (userId && freshArticles.length < 2) {
        console.log(`[Freshness Guard 🛑] User ${userId} has insufficient fresh unread articles (${freshArticles.length} found). Skipping briefing creation to prevent duplicate old news.`);
        return [];
    }

    const candidateArticles = freshArticles.length > 0 ? freshArticles : articles;

    const scoredArticles = candidateArticles.map((article: any) => {
        const publishedDate = article.published_at ? new Date(article.published_at).getTime() : now;
        const ageInDays = Math.max(0, (now - publishedDate) / (1000 * 60 * 60 * 24));
        const recencyWeight = Math.exp(-0.05 * ageInDays);
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

    const chatCompletion = await groq.chat.completions.create({
        messages: [
            { role: 'system', content: SCRIPTWRITER_SYSTEM_PROMPT },
            { role: 'user', content: prompt }
        ],
        model: 'llama-3.1-8b-instant',
    });

    return chatCompletion.choices[0]?.message?.content || "";
}
