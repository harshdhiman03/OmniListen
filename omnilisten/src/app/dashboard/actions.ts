"use server";

import { supabaseServer } from '@/lib/supabase';
import { getRelevantArticles, generatePodcastScript } from '@/services/scriptwriter.service';
import { segmentScriptIntoChunks, generateAudioBufferForChunk } from '@/services/tts.service';
import { uploadAudioChunk } from '@/services/storage.service';
import { revalidatePath } from 'next/cache';

/**
 * Next.js 14 Server Action. 
 * Allows the client to securely trigger intense backend audio synthesis dynamically 
 * without having to hit the hardcoded Vercel API cron routes.
 */
export async function generateOnDemandBriefing(userId: string) {
    try {
        const { data: user } = await supabaseServer
            .from('profiles')
            .select('interest_vector')
            .eq('id', userId)
            .single();
            
        if (!user?.interest_vector) {
            throw new Error("No semantic interest vector found. Please complete onboarding.");
        }

        const sessionDateId = new Date().toISOString().split('T')[0];

        console.log(`[Server Action] Synthesizing script for user ${userId}...`);
        const articles = await getRelevantArticles(user.interest_vector);
        const scriptResponse = await generatePodcastScript(articles);
        const chunks = segmentScriptIntoChunks(scriptResponse);
        
        console.log(`[Server Action] Generating MP3 blobs for ${chunks.length} chunks...`);
        const publicUrls = [];
        for (let i = 0; i < chunks.length; i++) {
            const audioBuffer = await generateAudioBufferForChunk(chunks[i]);
            const url = await uploadAudioChunk(audioBuffer, userId, sessionDateId, i + 1);
            publicUrls.push(url);
        }

        console.log(`[Server Action] Saving playlist to database...`);
        await supabaseServer.from('daily_playlists').insert({
            user_id: userId,
            audio_urls: publicUrls
        });

        // Vercel Cache Invalidaton — Instantly updates the Dashboard UI!
        revalidatePath('/dashboard');
        
        return { success: true };
    } catch (error: any) {
        console.error("Dashboard Server Action failed:", error);
        return { success: false, error: error.message };
    }
}
