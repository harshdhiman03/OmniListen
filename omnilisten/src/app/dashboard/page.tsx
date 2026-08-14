import React from 'react';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase';
import PlaylistSelector from '@/components/PlaylistSelector';
import GenerateButton from '@/components/GenerateButton';
import LogoutButton from '@/components/LogoutButton';
import LanguageSelector from '@/components/LanguageSelector';

// Bypass aggressive static caching exclusively for the dashboard
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    // 1. Fetch Authenticated User Session natively using standard SSR token decryption
    const { createClient } = await import('@/utils/supabase/server');
    const supabaseSession = await createClient();
    const { data: { user } } = await supabaseSession.auth.getUser();

    if (!user) {
        // Edge middleware executes first, but this acts as a hard failsafe for SSR renders
        return null;
    }
    
    // Strict Sandbox Query: Only fetch profiles associated precisely with the encrypted JWT identity!
    const { data: profileData } = await supabaseServer
        .from('profiles')
        .select('id, first_name, preferred_language')
        .eq('id', user.id)
        .not('interest_vector', 'is', null)
        .single();

    // If zero profiles exist with onboarding data for this specific user, intercept gracefully!
    if (!profileData) {
        redirect('/onboarding');
    }

    const userId = profileData.id;
    const userName = profileData.first_name || 'Listener';
    const currentLanguage = profileData.preferred_language || 'en';

    // 2. Query generated compilations natively!
    const { data: playlists } = await supabaseServer
        .from('daily_playlists')
        .select('id, audio_urls, audio_urls_by_lang, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(15);

    const latestPlaylist = playlists && playlists.length > 0 ? playlists[0] : null;

    // Dynamically override audio_urls if cached for user's preferred_language
    const activePlaylists = (playlists || []).map((p: any) => {
        const langMap = (p.audio_urls_by_lang as Record<string, string[]>) || {};
        if (langMap[currentLanguage] && langMap[currentLanguage].length > 0) {
            return { ...p, audio_urls: langMap[currentLanguage] };
        }
        return p;
    });

    return (
        <div className="min-h-screen bg-transparent bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-900 via-gray-950 to-black text-white font-sans selection:bg-cyan-500/30 font-inter flex flex-col items-center justify-start overflow-x-hidden">
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative min-h-screen flex flex-col items-center">
                
                {/* Production-Ready Liquid Glassmorphic Header Component */}
                <header className="w-full flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pt-8 pb-6 mb-8 border-b border-white/5 animate-in fade-in slide-in-from-top-4 duration-700">
                    
                    {/* 1. Brand Badge & Typographic Hierarchy (Left Side) */}
                    <div className="flex items-center gap-4">
                        <div className="relative group cursor-pointer">
                            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-[28px] sm:rounded-[32px] bg-black/70 flex items-center justify-center border-2 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.4)] ring-1 ring-white/10 p-0.5 transition-all duration-300 transform-gpu group-hover:scale-105 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] overflow-hidden">
                                <Image 
                                    src="/omnilogo.png" 
                                    alt="OmniListen Brand Logo" 
                                    width={56} 
                                    height={56} 
                                    className="w-full h-full object-contain rounded-full drop-shadow-[0_0_15px_rgba(6,182,212,0.9)] drop-shadow-[0_0_25px_rgba(6,182,212,0.6)] shrink-0"
                                    priority
                                />
                            </div>
                        </div>
                        <div className="flex flex-col space-y-1">
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight leading-none text-white">
                                Good morning,{" "}
                                <span className="bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 bg-clip-text text-transparent drop-shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                                    {userName}
                                </span>
                            </h1>
                            <p className="text-xs font-bold text-zinc-400/80 uppercase tracking-widest pt-0.5">
                                YOUR DAILY BRIEFING IS READY
                            </p>
                        </div>
                    </div>

                    {/* 2. Utility Navigation (Right Side) */}
                    <div className="flex items-center gap-3 sm:gap-4 self-end sm:self-auto">
                        <LanguageSelector 
                            currentLanguage={currentLanguage} 
                            activePlaylistId={latestPlaylist?.id} 
                        />
                        
                        <LogoutButton />
                        
                        {/* Sophisticated Glassmorphic Profile Avatar */}
                        <div className="relative group cursor-pointer">
                            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-cyan-500/20 to-blue-600/30 border border-cyan-500/30 shadow-[0_0_18px_rgba(6,182,212,0.25)] ring-2 ring-white/10 flex items-center justify-center font-bold text-sm sm:text-base text-cyan-300 transform group-hover:scale-105 group-hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] transition-all duration-300">
                                {userName.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="w-full flex flex-col items-center justify-center animate-in fade-in zoom-in duration-1000 delay-150 relative z-10 flex-1 pb-16">
                    {activePlaylists && activePlaylists.length > 0 ? (
                        <div className="w-full flex flex-col items-center justify-center">
                            {/* Inject the Client Component Selector Seamlessly */}
                            <PlaylistSelector userId={userId} playlists={activePlaylists} />
                        </div>
                    ) : (
                        <div className="w-full max-w-xl mx-auto bg-gray-900/40 border border-white/5 rounded-3xl p-12 text-center shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-xl space-y-6 mt-16 group transition-all duration-500 hover:border-white/10 hover:bg-gray-900/60">
                            <div className="w-24 h-24 mx-auto rounded-full bg-white/5 flex items-center justify-center mb-8 shadow-inner border border-white/5 group-hover:scale-110 transition-transform duration-500 group-hover:border-cyan-500/30 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                                <svg className="w-12 h-12 text-cyan-400 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                            </div>
                            <h2 className="text-3xl font-extrabold tracking-tight">No Briefing Loaded for Today</h2>
                            <p className="text-gray-400 text-lg leading-relaxed max-w-md mx-auto">
                                Select your preferred language above and click below to generate your personalized AI news podcast!
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
