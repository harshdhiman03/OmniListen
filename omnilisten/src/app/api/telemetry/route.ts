import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { recalibrateUserInterestVector } from '@/services/recalibration.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { user_id, article_id, action_type, duration_listened_seconds } = body;

        // Validation against empty essential telemetry payloads (allowing 0 as a valid article_id)
        if (!user_id || article_id === undefined || article_id === null || !action_type) {
            return NextResponse.json(
                { error: 'Missing required telemetry fields' }, 
                { status: 400 }
            );
        }

        // Translate dummy Article ID (0) mathematically to null so PostgreSQL 
        // doesn't attempt to strictly map it against the "articles" foreign key table!
        const finalArticleId = article_id === 0 ? null : article_id;

        // Write the incoming row directly into the 'interactions' table securely
        const { error } = await supabaseServer
            .from('interactions')
            .insert({
                user_id,
                article_id: finalArticleId,
                action_type,
                duration_listened_seconds: duration_listened_seconds || 0
            });

        if (error) {
            console.error("Telemetry DB insertion failed:", error);
            return NextResponse.json(
                { error: 'Failed to record interaction to database' }, 
                { status: 500 }
            );
        }

        // Asynchronously trigger preference vector recalibration for key telemetry events
        if (['complete', 'skip', 'heart'].includes(action_type) || (duration_listened_seconds && duration_listened_seconds >= 30)) {
            recalibrateUserInterestVector(user_id).catch(err => {
                console.warn("Async telemetry vector recalibration error:", err);
            });
        }

        return NextResponse.json({ success: true, recalibrating: true });

    } catch (error: any) {
        console.error("Telemetry route error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error inserting telemetry" }, 
            { status: 500 }
        );
    }
}
