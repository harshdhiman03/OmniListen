import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getRelevantArticles, generatePodcastScript } from '@/services/scriptwriter.service';
import { segmentScriptIntoChunks, generateAudioBufferForChunk } from '@/services/tts.service';
import { uploadAudioChunk } from '@/services/storage.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Up to 60s execution per user worker

/**
 * Isolated Worker Endpoint for single-user briefing processing.
 * Solves Vercel HTTP timeouts by providing dedicated execution bounds and fault isolation per user.
 */
export async function GET(request: Request) {
    const startTime = Date.now();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized calling worker identity' }, { status: 401 });
        }

        if (!userId) {
            return NextResponse.json({ error: 'Missing required userId parameter' }, { status: 400 });
        }

        // 1. Fetch user profile
        const { data: user, error: profileError } = await supabaseServer
            .from('profiles')
            .select('id, interest_vector, preferred_language')
            .eq('id', userId)
            .single();

        if (profileError || !user || !user.interest_vector) {
            return NextResponse.json({ error: `User profile ${userId} not found or vector empty` }, { status: 404 });
        }

        const sessionDateId = new Date().toISOString().split('T')[0];
        const preferredLanguage = user.preferred_language || 'en';

        // 2. Retrieve matched news stories with deduplication filter
        const articles = await getRelevantArticles(user.interest_vector, userId);
        if (!articles || articles.length === 0) {
            return NextResponse.json({ status: "No articles matched", userId }, { status: 200 });
        }

        const articleIds = articles.map(a => Number(a.id)).filter(Boolean);

        // 3. Draft podcast script via Groq LLaMA in target language
        const scriptResponse = await generatePodcastScript(articles, preferredLanguage);
        const chunks = segmentScriptIntoChunks(scriptResponse);

        // 4. Synthesize & Upload Audio Chunks in target language
        const publicUrls: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
            const audioBuffer = await generateAudioBufferForChunk(chunks[i], preferredLanguage);
            const url = await uploadAudioChunk(audioBuffer, userId, sessionDateId, i + 1, preferredLanguage);
            publicUrls.push(url);
        }

        // 5. Insert Daily Playlist Record
        const initialCache = { [preferredLanguage]: publicUrls };
        const { error: insertError } = await supabaseServer
            .from('daily_playlists')
            .insert({
                user_id: userId,
                audio_urls: publicUrls,
                script_text: scriptResponse,
                audio_urls_by_lang: initialCache,
                article_ids: articleIds
            });

        if (insertError) {
            throw new Error(`Database insert failed: ${insertError.message}`);
        }

        const executionTimeMs = Date.now() - startTime;

        // Log execution metrics to cron_logs
        try {
            await supabaseServer.from('cron_logs').insert({
                cron_name: `worker-process-user-${userId}`,
                status: 'Success',
                details: { userId, articleCount: articles.length, chunkCount: chunks.length },
                execution_time_ms: executionTimeMs
            });
        } catch (logErr) {
            console.warn("Failed to write worker log:", logErr);
        }

        return NextResponse.json({ 
            status: "Success", 
            userId, 
            processed: true,
            executionTimeMs 
        }, { status: 200 });

    } catch (error: any) {
        const executionTimeMs = Date.now() - startTime;
        console.error(`Worker error processing user ${userId}:`, error);

        try {
            await supabaseServer.from('cron_logs').insert({
                cron_name: `worker-process-user-${userId}`,
                status: 'Error',
                details: { userId, error: error.message || "Worker execution failed" },
                execution_time_ms: executionTimeMs
            });
        } catch (logErr) {
            console.warn("Failed to write worker error log:", logErr);
        }

        return NextResponse.json({ error: error.message || "Worker execution failed", userId }, { status: 500 });
    }
}
