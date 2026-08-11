import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { recalibrateUserInterestVector } from '@/services/recalibration.service';

export const dynamic = 'force-dynamic';

/**
 * Automated Cron Endpoint for batch user interest vector recalibration.
 * Scans active users who logged listening interactions in the past 7 days
 * and updates their 768-dimensional interest_vectors based on preference shifts.
 */
export async function GET(request: Request) {
    const startTime = Date.now();
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized calling recalibration identity' }, { status: 401 });
        }

        // 1. Fetch active users with profiles
        const { data: users, error: profileError } = await supabaseServer
            .from('profiles')
            .select('id')
            .not('interest_vector', 'is', null);

        if (profileError || !users) {
            return NextResponse.json({ error: 'Failed to fetch profiles for recalibration' }, { status: 500 });
        }

        let shiftAppliedCount = 0;

        for (const user of users) {
            const result = await recalibrateUserInterestVector(user.id);
            if (result.shiftApplied) {
                shiftAppliedCount++;
            }
        }

        const executionTimeMs = Date.now() - startTime;
        const resultPayload = {
            status: "Success",
            totalUsersScanned: users.length,
            shiftAppliedCount,
            executionTimeMs
        };

        // Log execution to cron_logs table
        try {
            await supabaseServer.from('cron_logs').insert({
                cron_name: 'recalibrate-vectors',
                status: 'Success',
                details: resultPayload,
                execution_time_ms: executionTimeMs
            });
        } catch (logErr) {
            console.warn("Failed to write recalibration log:", logErr);
        }

        return NextResponse.json(resultPayload, { status: 200 });

    } catch (err: any) {
        const executionTimeMs = Date.now() - startTime;
        console.error("Cron vector recalibration error:", err);
        return NextResponse.json({ error: err.message || "Vector recalibration failed" }, { status: 500 });
    }
}
