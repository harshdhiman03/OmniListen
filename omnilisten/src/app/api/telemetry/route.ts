import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

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

        // Translate the dummy Article ID mathematically to null so PostgreSQL 
        // doesn't attempt to strictly map it against the "articles" foreign key table!
        const finalArticleId = article_id === 0 ? null : article_id;

        // Write the incoming row directly into the 'interactions' table securely
        const { error } = await supabaseServer
            .from('interactions')
            .insert({
                user_id,
                article_id: finalArticleId,
                action_type,
                duration_listened_seconds
            });

        if (error) {
            console.error("Telemetry DB insertion failed:", error);
            return NextResponse.json(
                { error: 'Failed to record interaction to database' }, 
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Telemetry route error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error inserting telemetry" }, 
            { status: 500 }
        );
    }
}
