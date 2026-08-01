"use server";

import { createClient } from '@/utils/supabase/server';
import { supabaseServer } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { getUserInterestVectorAndLanguage, getRelevantArticles, generatePodcastScript } from '@/services/scriptwriter.service';
import { segmentScriptIntoChunks, generateAudioBufferForChunk } from '@/services/tts.service';
import { uploadAudioChunk } from '@/services/storage.service';

/**
 * Server Action to update the user's preferred language in Supabase profiles.
 */
export async function updateUserLanguagePreference(newLanguage: string) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error("Unauthorized JWT Session");
        }

        const { error } = await supabaseServer
            .from('profiles')
            .update({ preferred_language: newLanguage })
            .eq('id', user.id);

        if (error) {
            throw new Error(`Failed to update language: ${error.message}`);
        }

        revalidatePath('/dashboard');
        return { success: true, language: newLanguage };
    } catch (error: any) {
        console.error("Failed to update language preference:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Senior Architect Lazy Multi-Lingual Translation & Audio Caching Server Action.
 * Checks if target language MP3s are cached in audio_urls_by_lang[targetLanguage].
 * If cached: returns 0ms instant URLs.
 * If uncached: translates script, synthesizes MP3s, uploads to storage, caches in DB, and returns URLs.
 */
export async function translateAndSynthesizePlaylist(playlistId: string, targetLanguage: string) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error("Unauthorized JWT Session");
        }

        const userId = user.id;

        // 1. Fetch playlist record from Supabase
        const { data: playlist, error: playlistError } = await supabaseServer
            .from('daily_playlists')
            .select('id, user_id, created_at, audio_urls_by_lang, script_text')
            .eq('id', playlistId)
            .single();

        if (playlistError || !playlist) {
            throw new Error(`Playlist ${playlistId} not found`);
        }

        const audioCache = (playlist.audio_urls_by_lang as Record<string, string[]>) || {};

        // 2. ZERO-DELAY CACHE HIT: Return existing audio URLs if already generated for target language
        if (audioCache[targetLanguage] && audioCache[targetLanguage].length > 0) {
            console.log(`[Cache Hit ⚡] Target language [${targetLanguage}] already synthesized for playlist ${playlistId}`);
            return { success: true, audioUrls: audioCache[targetLanguage], cached: true };
        }

        console.log(`[Lazy Synthesis 🎙️] Synthesizing target language [${targetLanguage}] for playlist ${playlistId}...`);

        const sessionDateId = new Date(playlist.created_at || Date.now()).toISOString().split('T')[0];

        // 3. Fetch matched news articles using user vector
        const { vector: interestVector } = await getUserInterestVectorAndLanguage(userId);
        const articles = await getRelevantArticles(interestVector);

        // 4. Draft translated podcast script in target language
        const scriptResponse = await generatePodcastScript(articles, targetLanguage);
        const chunks = segmentScriptIntoChunks(scriptResponse);

        // 5. Synthesize MP3 buffers and upload to Supabase Storage under user_id/date/lang/
        const publicUrls: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
            const audioBuffer = await generateAudioBufferForChunk(chunks[i], targetLanguage);
            const url = await uploadAudioChunk(audioBuffer, userId, sessionDateId, i + 1, targetLanguage);
            publicUrls.push(url);
        }

        // 6. Update JSONB cache on daily_playlists
        const updatedCache = { ...audioCache, [targetLanguage]: publicUrls };
        const { error: updateError } = await supabaseServer
            .from('daily_playlists')
            .update({
                audio_urls_by_lang: updatedCache,
                audio_urls: publicUrls // update active URLs
            })
            .eq('id', playlistId);

        if (updateError) {
            console.error("Failed to update playlist audio cache:", updateError);
        }

        revalidatePath('/dashboard');

        return { success: true, audioUrls: publicUrls, cached: false };

    } catch (error: any) {
        console.error("Failed to translate/synthesize playlist:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Server Action to directly generate the on-demand briefing synchronously.
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

        // 1. Fetch interest vector and preferred language
        const { vector: interestVector, language: preferredLanguage } = await getUserInterestVectorAndLanguage(userId);
        if (!interestVector) {
            throw new Error("User interest vector not found. Please complete onboarding.");
        }

        console.log(`[Server Action] Synthesizing briefing in language: [${preferredLanguage}]`);

        // 2. Retrieve matched news stories
        const articles = await getRelevantArticles(interestVector);
        if (!articles || articles.length === 0) {
            throw new Error("No matching news articles found. Please try ingesting news first.");
        }

        // 3. Draft script in target language
        const scriptResponse = await generatePodcastScript(articles, preferredLanguage);
        const chunks = segmentScriptIntoChunks(scriptResponse);

        // 4. Synthesize & Upload Audio Chunks in target language
        const publicUrls: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
            const audioBuffer = await generateAudioBufferForChunk(chunks[i], preferredLanguage);
            const url = await uploadAudioChunk(audioBuffer, userId, sessionDateId, i + 1, preferredLanguage);
            publicUrls.push(url);
        }

        // 5. Insert Playlist Record with audio_urls_by_lang cache map
        const initialCache = { [preferredLanguage]: publicUrls };
        const { error: insertError } = await supabaseServer
            .from('daily_playlists')
            .insert({
                user_id: userId,
                audio_urls: publicUrls,
                script_text: scriptResponse,
                audio_urls_by_lang: initialCache
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
