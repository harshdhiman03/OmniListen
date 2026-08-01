"use server";

import { createClient } from '@/utils/supabase/server';
import { supabaseServer } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { getUserInterestVector, getRelevantArticles, generatePodcastScript } from '@/services/scriptwriter.service';
import { segmentScriptIntoChunks, generateAudioBufferForChunk } from '@/services/tts.service';
import { uploadAudioChunk } from '@/services/storage.service';

/**
 * Next.js Server Action.
 * Directly generates the audiobook synchronously on Vercel and updates the playlist database.
 */
export async function generateOnDemandBriefing(_clientSideId?: string) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error("Unauthorized JWT Session");
        }
        
        const userId = user.id;
        const sessionDateId = new Date().toISOString().split('T')[0];

        console.log(`[Server Action] Generating on-demand audio briefing for user ${userId}...`);

        // 1. Fetch interest vector
        const interestVector = await getUserInterestVector(userId);
        if (!interestVector) {
            throw new Error("User interest vector not found. Please complete onboarding.");
        }

        // 2. Retrieve matched news stories
        const articles = await getRelevantArticles(interestVector);
        if (!articles || articles.length === 0) {
            throw new Error("No matching news articles found. Please try ingesting news first.");
        }

        // 3. Draft script
        const scriptResponse = await generatePodcastScript(articles);
        const chunks = segmentScriptIntoChunks(scriptResponse);

        // 4. Synthesize & Upload Audio Chunks
        const publicUrls: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
            const audioBuffer = await generateAudioBufferForChunk(chunks[i]);
            const url = await uploadAudioChunk(audioBuffer, userId, sessionDateId, i + 1);
            publicUrls.push(url);
        }

        // 5. Insert Playlist Record
        const { error: insertError } = await supabaseServer
            .from('daily_playlists')
            .insert({
                user_id: userId,
                audio_urls: publicUrls
            });

        if (insertError) {
            throw new Error(`Database insert failed: ${insertError.message}`);
        }

        revalidatePath('/dashboard');
        
        return { success: true, status: "Audiobook generated successfully" };
    } catch (error: any) {
        console.error("Dashboard Server Action failed:", error);
        return { success: false, error: error.message };
    }
}
