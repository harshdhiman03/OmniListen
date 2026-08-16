import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getRelevantArticles, generatePodcastScript } from '@/services/scriptwriter.service';
import { segmentScriptIntoChunks, generateAudioBufferForChunk } from '@/services/tts.service';
import { uploadAudioChunk } from '@/services/storage.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Up to 60s execution per user worker

/**
 * Senior Architecture Resilient Worker Route with Idempotency Keys & Step Checkpointing.
 * Prevents mid-flight crashes (Groq API 429 throttling, TTS network errors, storage disconnects)
 * from wasting API tokens or duplicating daily playlist database records.
 */
export async function GET(request: Request) {
    const startTime = Date.now();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const forceReplay = searchParams.get('force') === 'true';

    const sessionDateId = new Date().toISOString().split('T')[0];
    const idempotencyKey = `briefing_${userId}_${sessionDateId}`;

    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized calling worker identity' }, { status: 401 });
        }

        if (!userId) {
            return NextResponse.json({ error: 'Missing required userId parameter' }, { status: 400 });
        }

        // 1. Fetch existing job state for idempotency & checkpoint recovery
        const { data: existingJob } = await supabaseServer
            .from('briefing_jobs')
            .select('*')
            .eq('idempotency_key', idempotencyKey)
            .maybeSingle();

        // Short-Circuit #1: If job is already COMPLETED today with playlist generated (DONE), return success immediately
        if (existingJob?.status === 'COMPLETED' && existingJob?.current_step === 'DONE' && !forceReplay) {
            return NextResponse.json({
                status: "Success",
                reason: "Already Completed Today (Idempotent Short-Circuit)",
                userId,
                idempotencyKey,
                executionTimeMs: Date.now() - startTime
            }, { status: 200 });
        }

        // Short-Circuit #2: If job is in DEAD_LETTER queue, block automatic execution unless explicitly forced
        if (existingJob?.status === 'DEAD_LETTER' && !forceReplay) {
            return NextResponse.json({
                status: "DeadLetter",
                reason: "Job in Dead Letter Queue. Max retries exhausted.",
                userId,
                error: existingJob.error_message,
                executionTimeMs: Date.now() - startTime
            }, { status: 422 });
        }

        // 2. Fetch user profile
        const { data: user, error: profileError } = await supabaseServer
            .from('profiles')
            .select('id, interest_vector, preferred_language')
            .eq('id', userId)
            .single();

        if (profileError || !user || !user.interest_vector) {
            return NextResponse.json({ error: `User profile ${userId} not found or vector empty` }, { status: 404 });
        }

        const preferredLanguage = user.preferred_language || 'en';

        // Initialize / Update job record to PROCESSING
        await supabaseServer
            .from('briefing_jobs')
            .upsert({
                idempotency_key: idempotencyKey,
                user_id: userId,
                session_date: sessionDateId,
                status: 'PROCESSING',
                current_step: existingJob?.current_step || 'INIT',
                updated_at: new Date().toISOString()
            });

        // 3. STEP CHECKPOINT 1: Script Generation
        let scriptResponse = existingJob?.script_text;
        let articleIds: number[] = existingJob?.article_ids || [];

        if (!scriptResponse || scriptResponse.trim() === '') {
            // Retrieve matched news stories with deduplication & Strict Freshness Guard
            const articles = await getRelevantArticles(user.interest_vector, userId);
            if (!articles || articles.length === 0) {
                const executionTimeMs = Date.now() - startTime;
                console.log(`[Worker Skipped] User ${userId} has no fresh unread news articles for today.`);

                await supabaseServer
                    .from('briefing_jobs')
                    .update({
                        status: 'SKIPPED',
                        current_step: 'SKIPPED',
                        error_message: 'No fresh unread news articles available for today',
                        updated_at: new Date().toISOString()
                    })
                    .eq('idempotency_key', idempotencyKey);

                return NextResponse.json({ 
                    status: "Skipped", 
                    reason: "No fresh unread news articles available for today", 
                    userId,
                    executionTimeMs 
                }, { status: 200 });
            }

            articleIds = articles.map(a => Number(a.id)).filter(Boolean);

            // Draft podcast script via Groq LLaMA in target language
            scriptResponse = await generatePodcastScript(articles, preferredLanguage);

            // Checkpoint script state into briefing_jobs
            await supabaseServer
                .from('briefing_jobs')
                .update({
                    status: 'SCRIPT_DONE',
                    current_step: 'SCRIPTING',
                    script_text: scriptResponse,
                    article_ids: articleIds,
                    updated_at: new Date().toISOString()
                })
                .eq('idempotency_key', idempotencyKey);
        } else {
            console.log(`[Checkpoint Hit 🎯] Reusing existing Groq script for User ${userId}. Zero LLM tokens consumed.`);
        }

        // 4. STEP CHECKPOINT 2: TTS Audio Synthesis & Storage Upload
        const chunks = segmentScriptIntoChunks(scriptResponse);
        const existingAudioUrls: string[] = Array.isArray(existingJob?.audio_urls) ? existingJob.audio_urls : [];

        // Synthesize & Upload Audio Chunks in parallel
        const chunkPromises = chunks.map(async (chunk, index) => {
            const chunkIndex = index + 1;
            // Check if chunk URL was already uploaded in previous attempt
            const existingUrl = existingAudioUrls.find(url => typeof url === 'string' && url.includes(`chunk_${chunkIndex}.mp3`));
            if (existingUrl) {
                return { index: chunkIndex, url: existingUrl };
            }

            const audioBuffer = await generateAudioBufferForChunk(chunk, preferredLanguage);
            const url = await uploadAudioChunk(audioBuffer, userId, sessionDateId, chunkIndex, preferredLanguage);
            return { index: chunkIndex, url };
        });

        const uploadedChunks = await Promise.all(chunkPromises);
        uploadedChunks.sort((a, b) => a.index - b.index);
        const publicUrls: string[] = uploadedChunks.map(c => c.url);

        // Checkpoint audio URLs into briefing_jobs
        await supabaseServer
            .from('briefing_jobs')
            .update({
                status: 'AUDIO_DONE',
                current_step: 'TTS_SYNTHESIS',
                audio_urls: publicUrls,
                updated_at: new Date().toISOString()
            })
            .eq('idempotency_key', idempotencyKey);

        // 5. STEP CHECKPOINT 3: Insert Daily Playlist Record
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

        // Mark job as COMPLETED in briefing_jobs
        await supabaseServer
            .from('briefing_jobs')
            .update({
                status: 'COMPLETED',
                current_step: 'DONE',
                error_message: null,
                updated_at: new Date().toISOString()
            })
            .eq('idempotency_key', idempotencyKey);

        const executionTimeMs = Date.now() - startTime;

        try {
            await supabaseServer.from('cron_logs').insert({
                cron_name: `worker-process-user-${userId}`,
                status: 'Success',
                details: { userId, articleCount: articleIds.length, chunkCount: chunks.length, idempotencyKey },
                execution_time_ms: executionTimeMs
            });
        } catch (logErr) {
            console.warn("Failed to write worker log:", logErr);
        }

        return NextResponse.json({ 
            status: "Success", 
            userId, 
            processed: true,
            idempotencyKey,
            executionTimeMs 
        }, { status: 200 });

    } catch (error: any) {
        const executionTimeMs = Date.now() - startTime;
        console.error(`Worker error processing user ${userId}:`, error);

        // State Machine Recovery: Calculate Exponential Backoff & DLQ status
        try {
            const { data: jobState } = await supabaseServer
                .from('briefing_jobs')
                .select('retry_count, max_retries')
                .eq('idempotency_key', idempotencyKey)
                .maybeSingle();

            const currentRetryCount = (jobState?.retry_count || 0) + 1;
            const maxRetries = jobState?.max_retries || 3;
            const isDeadLetter = currentRetryCount >= maxRetries;
            
            // Exponential backoff: 5m, 10m, 20m
            const nextRetryMs = Date.now() + Math.pow(2, currentRetryCount - 1) * 5 * 60 * 1000;
            const nextRetryAt = isDeadLetter ? null : new Date(nextRetryMs).toISOString();

            await supabaseServer
                .from('briefing_jobs')
                .upsert({
                    idempotency_key: idempotencyKey,
                    user_id: userId,
                    session_date: sessionDateId,
                    status: isDeadLetter ? 'DEAD_LETTER' : 'FAILED',
                    error_message: error.message || "Worker execution failed",
                    retry_count: currentRetryCount,
                    next_retry_at: nextRetryAt,
                    updated_at: new Date().toISOString()
                });

            await supabaseServer.from('cron_logs').insert({
                cron_name: `worker-process-user-${userId}`,
                status: isDeadLetter ? 'DeadLetter' : 'Error',
                details: { userId, error: error.message || "Worker execution failed", retryCount: currentRetryCount, isDeadLetter },
                execution_time_ms: executionTimeMs
            });
        } catch (logErr) {
            console.warn("Failed to update DLQ / briefing_jobs error state:", logErr);
        }

        return NextResponse.json({ error: error.message || "Worker execution failed", userId }, { status: 500 });
    }
}
