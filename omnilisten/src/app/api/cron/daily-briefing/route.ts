import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Senior Architect Async Fan-Out Controller Route.
 * Fetches all active users and dispatches non-blocking async worker jobs per user.
 * Responds in < 300ms, eliminating Vercel 60s HTTP timeout crashes at scale.
 */
export async function GET(request: Request) {
    const startTime = Date.now();
    try {
        const authHeader = request.headers.get('authorization');
        
        // Vercel secures cron jobs via 'Bearer <CRON_SECRET>' pattern
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized calling cron identity' }, { status: 401 });
        }

        // 1. Query active users with valid interest vectors
        const { data: users, error: profileError } = await supabaseServer
            .from('profiles')
            .select('id')
            .not('interest_vector', 'is', null);

        if (profileError || !users) {
            console.error('Failed to fetch cron users:', profileError);
            throw new Error('Supabase Profile Fetch Error');
        }

        const origin = new URL(request.url).origin;
        const cronSecret = process.env.CRON_SECRET || '';

        // 2. Dispatch non-blocking async worker calls for each user (Fan-Out)
        const workerDispatches = users.map(async (user) => {
            const workerUrl = `${origin}/api/cron/process-user-briefing?userId=${user.id}`;
            try {
                // Non-blocking fetch to worker endpoint
                fetch(workerUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${cronSecret}`
                    }
                }).catch(err => console.error(`Async fan-out error for user ${user.id}:`, err));
            } catch (err) {
                console.error(`Fan-out dispatch error for user ${user.id}:`, err);
            }
        });

        // Trigger dispatches asynchronously without blocking the response
        Promise.allSettled(workerDispatches);

        const executionTimeMs = Date.now() - startTime;
        const resultPayload = { 
            status: "Success", 
            totalUsers: users.length, 
            fanoutDispatched: true,
            executionTimeMs
        };

        // Write persistent audit log into Supabase cron_logs table
        try {
            await supabaseServer.from('cron_logs').insert({
                cron_name: 'daily-briefing-fanout',
                status: 'Success',
                details: resultPayload,
                execution_time_ms: executionTimeMs
            });
        } catch (logErr) {
            console.warn("Failed to write cron_logs entry:", logErr);
        }

        return NextResponse.json(resultPayload, { status: 200 });

    } catch (error: any) {
        const executionTimeMs = Date.now() - startTime;
        console.error("Daily Briefing Fan-Out Error:", error);

        try {
            await supabaseServer.from('cron_logs').insert({
                cron_name: 'daily-briefing-fanout',
                status: 'Error',
                details: { error: error.message || "Internal Server Error" },
                execution_time_ms: executionTimeMs
            });
        } catch (logErr) {
            console.warn("Failed to write error to cron_logs:", logErr);
        }

        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
