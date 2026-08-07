import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * Public/Admin In-App Cron Log Viewer Endpoint.
 * Allows tracking GNews API ingestion calls, raw vs inserted article counts,
 * and user worker execution statuses directly in the browser or Postman without Vercel paid logs.
 */
export async function GET() {
    try {
        // Query recent logs from Supabase cron_logs table
        const { data: logs, error } = await supabaseServer
            .from('cron_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(25);

        if (error) {
            // Fallback: If cron_logs table schema cache is pending, return fallback status with latest playlists & articles count
            const { count: articleCount } = await supabaseServer
                .from('articles')
                .select('*', { count: 'exact', head: true });

            const { count: playlistCount } = await supabaseServer
                .from('daily_playlists')
                .select('*', { count: 'exact', head: true });

            const { data: latestPlaylists } = await supabaseServer
                .from('daily_playlists')
                .select('id, user_id, created_at, article_ids')
                .order('created_at', { ascending: false })
                .limit(5);

            return NextResponse.json({
                status: "Admin Cron Audit (Fallback Summary)",
                totalArticlesInDatabase: articleCount || 0,
                totalPlaylistsGenerated: playlistCount || 0,
                latestPlaylists: latestPlaylists || [],
                notice: "Detailed cron_logs table notice: " + error.message
            }, { status: 200 });
        }

        return NextResponse.json({
            status: "Success",
            count: logs?.length || 0,
            logs: logs || []
        }, { status: 200 });

    } catch (err: any) {
        console.error("Admin cron logs error:", err);
        return NextResponse.json({ error: err.message || "Failed to fetch cron logs" }, { status: 500 });
    }
}
