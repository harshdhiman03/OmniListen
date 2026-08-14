import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Public/Admin In-App Cron Log & Dead Letter Queue (DLQ) Viewer Endpoint.
 * Allows tracking GNews API ingestion calls, raw vs inserted article counts,
 * user worker execution statuses, and Dead Letter Queue state.
 */
export async function GET() {
    try {
        // Query recent logs from Supabase cron_logs table
        const { data: logs } = await supabaseServer
            .from('cron_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(25);

        // Query recent jobs and DLQ entries from briefing_jobs table
        const { data: jobs } = await supabaseServer
            .from('briefing_jobs')
            .select('id, idempotency_key, user_id, session_date, status, current_step, retry_count, max_retries, error_message, updated_at')
            .order('updated_at', { ascending: false })
            .limit(25);

        const deadLetterCount = jobs?.filter(j => j.status === 'DEAD_LETTER').length || 0;
        const failedCount = jobs?.filter(j => j.status === 'FAILED').length || 0;

        return NextResponse.json({
            status: "Success",
            logsCount: logs?.length || 0,
            jobsCount: jobs?.length || 0,
            deadLetterCount,
            failedCount,
            logs: logs || [],
            briefingJobs: jobs || []
        }, { status: 200 });

    } catch (err: any) {
        console.error("Admin cron logs error:", err);
        return NextResponse.json({ error: err.message || "Failed to fetch cron logs" }, { status: 500 });
    }
}
