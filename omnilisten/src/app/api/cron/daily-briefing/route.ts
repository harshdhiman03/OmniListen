import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

// Force Vercel to dynamically execute this script every run
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        
        // Vercel secures cron jobs via 'Bearer <CRON_SECRET>' pattern
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized calling cron identity' }, { status: 401 });
        }

        // 1. Fetch Active Users
        const { data: users, error: profileError } = await supabaseServer
            .from('profiles')
            .select('id')
            .not('interest_vector', 'is', null);

        if (profileError || !users) {
            console.error('Failed to fetch cron users:', profileError);
            throw new Error('Supabase Profile Fetch Error');
        }

        for (const user of users) {
            try {
                // Call the public wrapper to jump the hidden schema boundary natively within Postgres!
                const { error: mqError } = await supabaseServer.rpc('enqueue_audio_job', { p_user_id: user.id });

                if (mqError) {
                    console.error(`[Cron] PGMQ mapping failed for user ${user.id}:`, mqError);
                }
            } catch (err) {
                console.error(`[Cron] Queue fatal error for user ${user.id}:`, err);
            }
        }

        return NextResponse.json({ status: "Job added to queue" }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
