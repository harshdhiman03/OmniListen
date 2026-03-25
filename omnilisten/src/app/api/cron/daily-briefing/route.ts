import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

// We import the raw business logic out of our services so the Cron job isn't forced 
// to make fragile external HTTP fetch requests to itself!
import { getRelevantArticles, generatePodcastScript } from '@/services/scriptwriter.service';
import { segmentScriptIntoChunks, generateAudioBufferForChunk } from '@/services/tts.service';
import { uploadAudioChunk } from '@/services/storage.service';

// Force Vercel to dynamically execute this script every run and extend timeouts to maximum 60s
export const dynamic = 'force-dynamic';
export const maxDuration = 60; 

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        
        // Vercel secures cron jobs via 'Bearer <CRON_SECRET>' pattern
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized calling cron identity' }, { status: 401 });
        }

        // 1. Fetch Top 5 Users (MVP Vercel Hobby Timeout Constraints)
        // We only fetch users who successfully completed chat onboarding (they have a vector)
        const { data: users, error: profileError } = await supabaseServer
            .from('profiles')
            .select('id, interest_vector')
            .not('interest_vector', 'is', null) 
            .limit(5);

        if (profileError || !users) {
            console.error('Failed to fetch cron users:', profileError);
            throw new Error('Supabase Profile Fetch Error');
        }

        console.log(`[Cron] Booting daily playlists generation for ${users.length} users...`);

        // 2. Map Iteratively through Users
        for (const user of users) {
             // We wrap this inside a try-catch so one user failing doesn't kill the whole loop!
            try {
                // Determine a unique "Session ID" representing today's generated compilation (YYYY-MM-DD)
                const sessionDateId = new Date().toISOString().split('T')[0];

                // a) Generate Script logic internally without routing overhead
                const articles = await getRelevantArticles(user.interest_vector);
                const scriptResponse = await generatePodcastScript(articles);

                // b) Process Audio Chunks
                const chunks = segmentScriptIntoChunks(scriptResponse);
                const publicUrls: string[] = [];

                for (let i = 0; i < chunks.length; i++) {
                    const audioBuffer = await generateAudioBufferForChunk(chunks[i]);
                    const url = await uploadAudioChunk(audioBuffer, user.id, sessionDateId, i + 1);
                    publicUrls.push(url);
                }

                // c) Save to `daily_playlists` database table
                const { error: dbError } = await supabaseServer
                    .from('daily_playlists')
                    .insert({
                        user_id: user.id,
                        audio_urls: publicUrls,
                        // Note: created_at acts identically to native PostgreSQL defaults 
                    });

                if (dbError) {
                    console.error(`[Cron] Database insertion failed for user ${user.id}:`, dbError);
                } else {
                    console.log(`[Cron] Successfully compiled Daily Briefing for user ${user.id}!`);
                }

            } catch (err) {
                console.error(`[Cron] Failed to build playlist for user ${user.id}:`, err);
            }
        }

        return NextResponse.json({ success: true, processedUsers: users.length });

    } catch (error: any) {
        console.error("Cron job fatally failed:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" }, 
            { status: 500 }
        );
    }
}
