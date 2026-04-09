"use client";

import React, { useRef, useEffect } from 'react';
import { AudioPlayerProvider, useAudioPlayer, AudioTrack } from '@/contexts/AudioPlayerContext';
import LiquidOrb from '@/components/LiquidOrb';

interface AudioPlayerProps {
    userId: string;
    tracks: AudioTrack[];
}

function AudioPlayerUI({ userId }: { userId: string }) {
    // We magically destructure the wildly complex hardware Web Audio logic into completely pristine 
    // unified states using exactly what the user's Context specification designed!
    const { 
        isPlaying, 
        globalCurrentTime, 
        globalDuration, 
        currentIndex, 
        tracks 
    } = useAudioPlayer();

    // Telemetry Sync Hook - Transparently tracks when currentIndex changes natively from background hardware swaps
    const lastIndex = useRef(currentIndex);
    const lastTime = useRef(globalCurrentTime);
    
    useEffect(() => {
        lastTime.current = globalCurrentTime;
    }, [globalCurrentTime]);

    useEffect(() => {
        if (currentIndex > lastIndex.current) {
            // A track has changed seamlessly underneath the UI! 
            // If lastTime was very close to duration, it was a native completion swap. Otherwise requested skip.
            const action = (globalDuration > 0 && Math.abs(globalDuration - lastTime.current) < 3) ? "completed" : "skip";
            
            const prevTrack = tracks[lastIndex.current];
            if (prevTrack) {
                // Background telemetry logging decoupled from visual frame rendering!
                fetch('/api/telemetry', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        article_id: prevTrack.articleId || 0,
                        action_type: action,
                        duration_listened_seconds: Math.floor(lastTime.current)
                    })
                }).catch(console.error);
            }
            
            lastIndex.current = currentIndex;
        }
    }, [currentIndex, tracks, globalDuration, userId]);

    if (!tracks || tracks.length === 0) {
        return (
            <div className="w-full max-w-md mx-auto p-4 text-center rounded-2xl bg-gray-900 border border-white/5">
                <p className="text-gray-500 font-medium tracking-wide">No audio tracks available.</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md mx-auto bg-gray-900/60 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl transition-all duration-300 hover:shadow-cyan-500/10">
            <div className="flex flex-col items-center justify-center mb-6">
                <h3 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-1">
                    Seamless AI Podcast
                </h3>
            </div>

            {/* Injected Next-Gen Interactive Analyser and Control Deck */}
            <LiquidOrb />
        </div>
    );
}

// Wrapper flawlessly injects the Hardware Setup Context into the exact component hierarchy gracefully!
export default function AudioPlayer({ userId, tracks }: AudioPlayerProps) {
    return (
        <AudioPlayerProvider initialTracks={tracks}>
            <AudioPlayerUI userId={userId} />
        </AudioPlayerProvider>
    );
}
