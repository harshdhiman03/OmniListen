import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    try {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

        const { data, error } = await supabaseServer
            .from('daily_playlists')
            .select('id')
            .eq('user_id', userId)
            .gte('created_at', today.toISOString())
            .lt('created_at', tomorrow.toISOString())
            .limit(1)
            .single();

        return NextResponse.json({ exists: !!data });
    } catch (e) {
        // Gracefully return false on errors (like PGRST116 no rows found)
        return NextResponse.json({ exists: false });
    }
}
