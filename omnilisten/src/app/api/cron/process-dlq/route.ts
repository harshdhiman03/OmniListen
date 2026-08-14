import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Senior Architecture Dead Letter Queue (DLQ) Recovery Controller.
 * Scans for failed worker jobs due for retry, re-dispatching them to worker endpoints.
 * Operates idempotently: workers resume from their exact failed step checkpoint.
 */
export async function GET(request: Request) {
    const startTime = Date.now();
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized calling DLQ identity' }, { status: 401 });
        }

        const nowIso = new Date().toISOString();

        // Query jobs in FAILED status where next_retry_at <= NOW()
        const { data: failedJobs, error: fetchErr } = await supabaseServer
            .from('briefing_jobs')
            .select('id, user_id, idempotency_key, retry_count, current_step, error_message')
            .eq('status', 'FAILED')
            .lte('next_retry_at', nowIso)
            .limit(10);

        if (fetchErr) {
            console.error("Error querying DLQ failed jobs:", fetchErr);
            throw new Error(`DLQ Fetch Error: ${fetchErr.message}`);
        }

        if (!failedJobs || failedJobs.length === 0) {
            const executionTimeMs = Date.now() - startTime;
            return NextResponse.json({
                status: "Success",
                message: "No failed jobs pending retry in DLQ",
                pendingRetries: 0,
                executionTimeMs
            }, { status: 200 });
        }

        let baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : new URL(request.url).origin);
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
            baseUrl = `https://${baseUrl}`;
        }
        if (request.url.startsWith('https://') && baseUrl.startsWith('http://')) {
            baseUrl = baseUrl.replace('http://', 'https://');
        }

        const cronSecret = process.env.CRON_SECRET || '';

        // Re-dispatch failed jobs to worker endpoints
        const retryDispatches = failedJobs.map(async (job) => {
            const workerUrl = `${baseUrl}/api/cron/process-user-briefing?userId=${job.user_id}`;
            try {
                const res = await fetch(workerUrl, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${cronSecret}`
                    }
                });
                const resData = await res.json().catch(() => ({}));
                return { userId: job.user_id, idempotencyKey: job.idempotency_key, status: res.status, response: resData };
            } catch (err: any) {
                console.error(`DLQ retry dispatch error for user ${job.user_id}:`, err);
                return { userId: job.user_id, idempotencyKey: job.idempotency_key, status: 500, error: err.message };
            }
        });

        const dispatchResults = await Promise.allSettled(retryDispatches);

        const retryStatuses = dispatchResults.map((r, i) => {
            if (r.status === 'fulfilled') {
                return r.value;
            }
            return { userId: failedJobs[i].user_id, status: 500, error: String(r.reason) };
        });

        const successCount = retryStatuses.filter(w => w.status >= 200 && w.status < 300).length;
        const executionTimeMs = Date.now() - startTime;

        const resultPayload = {
            status: "DLQ Processed",
            totalFailedJobsFound: failedJobs.length,
            successfulRetries: successCount,
            retryStatuses,
            executionTimeMs
        };

        try {
            await supabaseServer.from('cron_logs').insert({
                cron_name: 'dlq-recovery-fanout',
                status: successCount === failedJobs.length ? 'Success' : 'PartialSuccess',
                details: resultPayload,
                execution_time_ms: executionTimeMs
            });
        } catch (logErr) {
            console.warn("Failed to log DLQ execution:", logErr);
        }

        return NextResponse.json(resultPayload, { status: 200 });

    } catch (err: any) {
        const executionTimeMs = Date.now() - startTime;
        console.error("DLQ Controller Error:", err);
        return NextResponse.json({ error: err.message || "DLQ processing failed" }, { status: 500 });
    }
}
