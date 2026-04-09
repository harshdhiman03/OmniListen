import { supabaseServer } from '@/lib/supabase';
import { genAI, SCRIPTWRITER_SYSTEM_PROMPT } from '@/lib/gemini';

/**
 * Fetches the user's personal interest embedding vector from Supabase.
 */
export async function getUserInterestVector(userId: string): Promise<number[]> {
    const { data: profileData, error } = await supabaseServer
        .from('profiles')
        .select('interest_vector')
        .eq('id', userId)
        .single();

    if (error || !profileData?.interest_vector) {
        console.error("Profile fetch error:", error);
        const customError: any = new Error('Failed to fetch user interest vector or vector is empty');
        customError.status = 404;
        throw customError;
    }

    return profileData.interest_vector;
}

/**
 * Executes an RPC call to match the user's vector against recent news articles.
 */
export async function getRelevantArticles(interestVector: number[]): Promise<any[]> {
    const { data: articles, error } = await supabaseServer
        .rpc('match_news_articles', {
            query_embedding: interestVector,
            match_threshold: -2.0,
            match_count: 3
        });

    if (error || !articles || articles.length === 0) {
        console.error("RPC matching error:", error);
        const customError: any = new Error('Failed to fetch highly relevant news articles');
        customError.status = 500;
        throw customError;
    }

    return articles;
}

import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

/**
 * Processes articles into a structured context string and prompts Groq LLaMA for a podcast script.
 */
export async function generatePodcastScript(articles: any[]): Promise<string> {
    const contextString = articles.map((article: any, index: number) => {
        return `### Story ${index + 1}\nTitle: ${article.title}\nContent:\n${article.content}`;
    }).join('\n\n---\n\n');

    const prompt = `Here are the top personalized news stories to discuss in today's podcast. Please process them into our script format:\n\n${contextString}

CRITICAL INSTRUCTIONS FOR AUDIO SYNTHESIS:
1. You are an on-demand spoken word podcaster. 
2. Rewrite these news articles into a single, cohesive 3-minute podcast script. 
3. Speak in a natural, conversational tone, as if you are talking to someone walking outdoors.
4. Keep sentences short and varied, and avoid lists and rigid explanations.
5. DO NOT output any markdown, asterisks, bolding, or special characters.
6. DO NOT include speaker labels (like "Host:") or stage directions (like "(Intro music fades in)"). 
7. Generate ONLY the exact words that should be spoken out loud by the voice engine.`;

    const chatCompletion = await groq.chat.completions.create({
        messages: [
            { role: 'system', content: SCRIPTWRITER_SYSTEM_PROMPT },
            { role: 'user', content: prompt }
        ],
        model: 'llama-3.1-8b-instant',
    });

    return chatCompletion.choices[0]?.message?.content || "";
}
