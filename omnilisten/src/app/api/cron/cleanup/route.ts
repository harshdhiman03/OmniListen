import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

// Secure Serverless CRON Endpoint!
// Vercel organically executes this by hitting the `/api/cron/cleanup` GET pathway.
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    const secret = process.env.CRON_SECRET;

    // Secure the bridge! Exclude hostile network traffic dynamically.
    if (secret && authHeader !== `Bearer ${secret}`) {
        return new NextResponse('Unauthorized Cron Execution Attempt', { status: 401 });
    }

    try {
        // Calculate the absolute boundary for "3 Days Ago"
        const boundaryDate = new Date();
        boundaryDate.setDate(boundaryDate.getDate() - 3);
        const isoBoundary = boundaryDate.toISOString();

        // Nuke obsolete backend telemetry organically
        const { error, count } = await supabaseServer
            .from('daily_playlists')
            .delete({ count: 'exact' })
            .lt('created_at', isoBoundary);

        if (error) throw error;

        return NextResponse.json({ 
            success: true, 
            message: `Cron Success: Expunged ${count || 'all applicable'} audio playlists older than ${isoBoundary}` 
        });

    } catch (error: any) {
        console.error("Cron Cleanup Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
