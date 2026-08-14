import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max 60s execution limit

/**
 * Senior Architect Async Fan-Out Controller Route.
 * Fetches all active users and dispatches parallel HTTP requests to worker endpoints.
 * Awaits all dispatches in parallel, guaranteeing zero dropped workers on Vercel Serverless.
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

        let baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : new URL(request.url).origin);
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
            baseUrl = `https://${baseUrl}`;
        }
        if (request.url.startsWith('https://') && baseUrl.startsWith('http://')) {
            baseUrl = baseUrl.replace('http://', 'https://');
        }

        const cronSecret = process.env.CRON_SECRET || '';

        // 2. Dispatch parallel HTTP requests to worker endpoints for each user
        const workerDispatches = users.map(async (user) => {
            const workerUrl = `${baseUrl}/api/cron/process-user-briefing?userId=${user.id}`;
            try {
                const res = await fetch(workerUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${cronSecret}`
                    }
                });
                const resData = await res.json().catch(() => ({}));
                return { userId: user.id, status: res.status, response: resData };
            } catch (err: any) {
                console.error(`Fan-out dispatch error for user ${user.id}:`, err);
                return { userId: user.id, status: 500, error: err.message };
            }
        });

        // Await all parallel worker dispatches before completing response on Vercel Serverless
        const dispatchResults = await Promise.allSettled(workerDispatches);

        const workerStatuses = dispatchResults.map((r, i) => {
            if (r.status === 'fulfilled') {
                return r.value;
            }
            return { userId: users[i].id, status: 500, error: String(r.reason) };
        });

        const successCount = workerStatuses.filter(w => w.status >= 200 && w.status < 300).length;
        const overallStatus = successCount === users.length ? "Success" : successCount > 0 ? "PartialSuccess" : "Error";

        const executionTimeMs = Date.now() - startTime;
        const resultPayload = { 
            status: overallStatus, 
            totalUsers: users.length, 
            successfulWorkers: successCount,
            dispatchedWorkers: dispatchResults.length,
            workerDetails: workerStatuses,
            executionTimeMs
        };

        // Write persistent audit log into Supabase cron_logs table
        try {
            await supabaseServer.from('cron_logs').insert({
                cron_name: 'daily-briefing-fanout',
                status: overallStatus,
                details: resultPayload,
                execution_time_ms: executionTimeMs
            });
        } catch (logErr) {
            console.warn("Failed to write cron_logs entry:", logErr);
        }

        return NextResponse.json(resultPayload, { status: overallStatus === "Error" ? 500 : 200 });

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
