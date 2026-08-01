import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { getRelevantArticles, generatePodcastScript } from '@/services/scriptwriter.service';
import { segmentScriptIntoChunks, generateAudioBufferForChunk } from '@/services/tts.service';
import { uploadAudioChunk } from '@/services/storage.service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s execution limit on Vercel

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        
        // Vercel secures cron jobs via 'Bearer <CRON_SECRET>' pattern
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized calling cron identity' }, { status: 401 });
        }

        // 1. Fetch Active Users with valid interest vectors & preferred language
        const { data: users, error: profileError } = await supabaseServer
            .from('profiles')
            .select('id, interest_vector, preferred_language')
            .not('interest_vector', 'is', null);

        if (profileError || !users) {
            console.error('Failed to fetch cron users:', profileError);
            throw new Error('Supabase Profile Fetch Error');
        }

        const sessionDateId = new Date().toISOString().split('T')[0];
        let processedCount = 0;

        for (const user of users) {
            try {
                const userId = user.id;
                const interestVector = user.interest_vector;
                const preferredLanguage = user.preferred_language || 'en';

                if (!interestVector) continue;

                // Step 2: Retrieve matched news stories
                const articles = await getRelevantArticles(interestVector);
                if (!articles || articles.length === 0) continue;

                // Step 3: Write podcast script via Groq LLaMA in target language
                const scriptResponse = await generatePodcastScript(articles, preferredLanguage);
                const chunks = segmentScriptIntoChunks(scriptResponse);

                // Step 4: Synthesize & Upload Audio Chunks in target language
                const publicUrls: string[] = [];
                for (let i = 0; i < chunks.length; i++) {
                    const audioBuffer = await generateAudioBufferForChunk(chunks[i], preferredLanguage);
                    const url = await uploadAudioChunk(audioBuffer, userId, sessionDateId, i + 1);
                    publicUrls.push(url);
                }

                // Step 5: Insert Daily Playlist Record
                const { error: insertError } = await supabaseServer
                    .from('daily_playlists')
                    .insert({
                        user_id: userId,
                        audio_urls: publicUrls
                    });

                if (!insertError) {
                    processedCount++;
                } else {
                    console.error(`Failed to insert playlist for user ${userId}:`, insertError);
                }

            } catch (err) {
                console.error(`Daily briefing error for user ${user.id}:`, err);
            }
        }

        return NextResponse.json({ 
            status: "Success", 
            totalUsers: users.length, 
            processedCount 
        }, { status: 200 });

    } catch (error: any) {
        console.error("Daily Briefing Cron Error:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
