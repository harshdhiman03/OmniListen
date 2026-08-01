import { config } from 'dotenv';
import { resolve } from 'path';

// Load the Next.js .env.local variables seamlessly into the standalone Node.js process IMMEDIATELY
config({ path: resolve(__dirname, '.env.local') });

// We use an async bootloader so that process.env is strictly guaranteed to be populated 
// BEFORE the Next.js typescript services are maliciously hoisted and evaluated by the V8 Engine!
async function processQueue() {
    const { createClient } = await import('@supabase/supabase-js');
    const { getRelevantArticles, generatePodcastScript, getUserInterestVector } = await import('./src/services/scriptwriter.service');
    const { segmentScriptIntoChunks, generateAudioBufferForChunk } = await import('./src/services/tts.service');
    const { uploadAudioChunk } = await import('./src/services/storage.service');

    // We define a standard public schema client for securely accessing the database 
    // over the restricted PostgREST API boundary.
    const publicSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
    );

    console.log("⚡ [OmniListen Queue Worker] Actively listening for 'audio_jobs'...");

    while (true) {
        try {
            // 1. Pop exactly 1 message from the 'audio_jobs' queue via a secure PUBLIC wrapper
            // This natively executes pgmq.pop under the hood while respecting the 5 minute visibility lock!
            const { data: messages, error: mqError } = await publicSupabase.rpc('pop_audio_job');

            if (mqError) throw new Error(`PGMQ Pop Error: ${mqError.message}`);

            if (messages && messages.length > 0) {
                const msg = messages[0];
                const userId = msg.message.user_id;
                const msgId = msg.msg_id;
                const sessionDateId = new Date().toISOString().split('T')[0];

                console.log(`\n======================================================`);
                console.log(`🚀 [Job Started] Found synthesis request for user: ${userId}`);
                console.time(`Job ${msgId} Execution Time`);

                try {
                    // Step 2: Extract User Intel
                    const interestVector = await getUserInterestVector(userId);
                    if (!interestVector) {
                        await publicSupabase.rpc('delete_audio_job', { p_msg_id: msgId });
                        throw new Error("Could not map a valid interest vector, isolated orphaned job deleted.");
                    }

                    // Step 3: Vector Knowledge Graph Retrieval
                    console.log(`[Job ${msgId}] Pulling latest relevant news matrix...`);
                    const articles = await getRelevantArticles(interestVector);
                    
                    // Step 4: AI Audio Scriptwriting
                    console.log(`[Job ${msgId}] Drafting specialized audio script via Groq LLaMA 3.1...`);
                    const scriptResponse = await generatePodcastScript(articles);
                    const chunks = segmentScriptIntoChunks(scriptResponse);

                    // Step 5: Advanced Speech Synthesis via Google Cloud
                    console.log(`[Job ${msgId}] Synthesizing and uploading ${chunks.length} distinct audio blocks...`);
                    const publicUrls: string[] = [];
                    for (let i = 0; i < chunks.length; i++) {
                        const audioBuffer = await generateAudioBufferForChunk(chunks[i]);
                        const url = await uploadAudioChunk(audioBuffer, userId, sessionDateId, i + 1);
                        publicUrls.push(url);
                        console.log(`                 -> Uploaded chunk ${i + 1}/${chunks.length}`);
                    }

                    // Step 6: THE CRITICAL MISSING DATABASE UI TRIGGER!
                    console.log(`[Job ${msgId}] Finalizing SQL insertion to instantly snap the frontend UI...`);
                    const { error: insertError } = await publicSupabase
                        .from('daily_playlists')
                        .insert({
                            user_id: userId,
                            audio_urls: publicUrls
                        });

                    if (insertError) {
                        console.error(`❌ [Job ${msgId}] Database Insert Failed: ${insertError.message}. Pruning job from PGMQ queue to prevent infinite synthesis retry loop.`);
                        await publicSupabase.rpc('delete_audio_job', { p_msg_id: msgId });
                        console.timeEnd(`Job ${msgId} Execution Time`);
                        continue;
                    }

                    // Step 7: Delete message from queue gracefully to signal permanent success!
                    await publicSupabase.rpc('delete_audio_job', { p_msg_id: msgId });
                    
                    console.log(`✅ [Job ${msgId}] Completed successfully! UI unlocked!`);
                    console.timeEnd(`Job ${msgId} Execution Time`);
                    console.log(`======================================================\n`);

                } catch (internalErr: any) {
                    console.error(`❌ [Job ${msgId}] FATAL FAILED:`, internalErr?.stack || internalErr?.message || internalErr);
                    
                    // Production Resilience: Native handler for Gemini API Free Tier rate limits!
                    if (internalErr?.message?.includes('429 Too Many Requests') || internalErr?.status === 429) {
                        console.log(`⚠️ [Rate Limit Hit] Pausing the entire queue processor for 60 seconds to allow Google API quotas to natively reset...`);
                        await new Promise(resolve => setTimeout(resolve, 60000));
                    } else {
                        console.log(`⚠️ [Job ${msgId}] Non-rate-limit failure. Message visibility lock will expire in PGMQ for automatic retry.`);
                    }
                }
            } else {
                // If queue is empty, sleep for 3 seconds
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

        } catch (error) {
            console.error("Critical worker loop failure:", error);
            await new Promise(resolve => setTimeout(resolve, 5000)); 
        }
    }
}

// Boot up the native loop architecture 
processQueue().catch(console.error);
