import { NextResponse } from 'next/server';
import { segmentScriptIntoChunks, generateAudioBufferForChunk } from '@/services/tts.service';
import { uploadAudioChunk } from '@/services/storage.service';

// NOTE: Depending on Vercel plan, you may want to un-comment this to increase execution limits for massive scripts:
// export const maxDuration = 60; // 60 seconds

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { script, user_id, session_id } = body;

        // 1. Validate Input Payload
        if (!script || !user_id || !session_id) {
            return NextResponse.json(
                { error: 'Missing required configuration fields (script, user_id, session_id)' }, 
                { status: 400 }
            );
        }

        // 2. Fragment the monolithic script into ~3 sentence chunks
        const chunks = segmentScriptIntoChunks(script);
        const publicUrls: string[] = [];

        // 3. Sequentially process chunks: Text -> Audio Buffer -> Supabase Storage
        for (let i = 0; i < chunks.length; i++) {
            try {
                // Synthesize Text completely entirely in-memory first
                const audioBuffer = await generateAudioBufferForChunk(chunks[i]);
                
                // Immediately stream the file to the dedicated Supabase Bucket
                const url = await uploadAudioChunk(audioBuffer, user_id, session_id, i + 1);
                
                publicUrls.push(url);
            } catch (chunkError) {
                console.error(`Failed to process chunk [${i + 1} / ${chunks.length}]:`, chunkError);
                // Optionally continue processing other chunks, or hard-fail. We'll hard fail here.
                throw chunkError;
            }
        }

        // 4. Hand off all completed Supabase Asset URLs to the frontend player
        return NextResponse.json({ urls: publicUrls });

    } catch (error: any) {
        console.error("Audio Generation orchestration failed:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error during Audio Processing" }, 
            { status: 500 }
        );
    }
}
