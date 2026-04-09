import React from 'react';
import { supabaseServer } from '@/lib/supabase';
import AudioPlayer from '@/components/AudioPlayer';
import GenerateButton from '@/components/GenerateButton';

// Bypass aggressive static caching exclusively for the dashboard
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    // 1. Fetch Authenticated User Session (Mocked flawlessly for the MVP)
    // In a production app with fully baked Supabase Auth cookies: 
    // const { data: { user } } = await supabaseServer.auth.getUser();
    
    const { data: profileData, error: profileError } = await supabaseServer
        .from('profiles')
        .select('id, first_name')
        .not('interest_vector', 'is', null)
        .limit(1)
        .single();

    // If zero profiles exist with onboarding data, intercept gracefully!
    if (!profileData) {
        return (
            <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-white font-sans">
                <div className="w-20 h-20 mb-6 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                    <svg className="w-10 h-10 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
                <h1 className="text-3xl font-extrabold mb-4 tracking-tight">No Active Profiles Detected</h1>
                <p className="text-gray-400 text-lg">Please complete the AI Onboarding Chat initialization first!</p>
            </div>
        );
    }

    const userId = profileData.id;
    const userName = profileData.first_name || 'Listener';

    // 2. Query today's generated compilation
    // Calculate precise daily epoch boundaries natively
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const { data: playlist } = await supabaseServer
        .from('daily_playlists')
        .select('audio_urls, created_at')
        .eq('user_id', userId)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    // The AudioPlayer securely expects `tracks: { url: string; articleId: number }[]`.
    // We map strings directly to the object structure, injecting dummy ID 0 for the MVP telemetry standard!
    const mappedTracks = playlist?.audio_urls 
        ? playlist.audio_urls.map((url: string) => ({ url, articleId: 0 }))
        : [];

    return (
        <div className="min-h-screen bg-transparent bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black text-white font-sans selection:bg-cyan-500/30 font-inter flex flex-col items-center justify-center overflow-hidden">
            <div className="w-full max-w-4xl mx-auto px-8 relative min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center">
                
                {/* Dashboard Profile Header */}
                <header className="flex items-center justify-between w-full max-w-2xl mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-extrabold tracking-tight">
                            Good morning, <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">{userName}</span>
                        </h1>
                        <p className="text-sm text-gray-400 font-medium tracking-wide uppercase">Your daily briefing is ready</p>
                    </div>
                    <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-xl shadow-cyan-500/20 flex items-center justify-center font-bold text-xl border border-gray-800 ring-2 ring-white/10 text-white transform hover:scale-105 transition-transform duration-300">
                        {userName.charAt(0).toUpperCase()}
                    </div>
                </header>

                <main className="w-full flex flex-col items-center justify-center animate-in fade-in zoom-in duration-1000 delay-150 relative z-10 flex-1">
                    {playlist && mappedTracks.length > 0 ? (
                        <div className="w-full flex flex-col items-center justify-center">
                            {/* Inject the Client Component Seamlessly */}
                            <AudioPlayer userId={userId} tracks={mappedTracks} />
                        </div>
                    ) : (
                        <div className="w-full max-w-xl mx-auto bg-gray-900/40 border border-white/5 rounded-3xl p-12 text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-xl space-y-6 mt-16 group transition-all duration-500 hover:border-white/10 hover:bg-gray-900/60">
                            <div className="w-24 h-24 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-8 shadow-inner border border-white/5 group-hover:scale-110 transition-transform duration-500 group-hover:border-cyan-500/30 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                                <svg className="w-12 h-12 text-cyan-400 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                            </div>
                            <h2 className="text-3xl font-extrabold tracking-tight">No Briefing Loaded for Today</h2>
                            <p className="text-gray-400 text-lg leading-relaxed max-w-md mx-auto">
                                You either just securely completed onboarding, or the 4:00 AM background cron-job hasn't organically triggered yet!
                            </p>
                            
                            <div className="pt-8 pb-2 w-full flex justify-center">
                                {/* Next.js 14 Safe Button Injection */}
                                <GenerateButton userId={userId} />
                            </div>
                        </div>
                    )}
                </main>
            </div>
            
            {/* Soft Cyan Background Glow injected far back */}
            <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-900/10 rounded-full blur-[150px] pointer-events-none -z-10 animate-pulse transition-opacity duration-[5000ms]" />
        </div>
    );
}
