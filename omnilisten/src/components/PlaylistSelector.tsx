"use client";

import React, { useState } from 'react';
import AudioPlayer from './AudioPlayer';

interface PlaylistRecord {
    created_at: string;
    audio_urls: string[];
}

export default function PlaylistSelector({ 
    userId, 
    playlists 
}: { 
    userId: string, 
    playlists: PlaylistRecord[] 
}) {
    const [activeIndex, setActiveIndex] = useState(0);

    // Render nothing if absolute database zero
    if (!playlists || playlists.length === 0) return null;

    // Extract relative day labels ("Today", "Yesterday", "2 Days Ago") natively without moment.js
    const getRelativeDayLabel = (dateString: string) => {
        const target = new Date(dateString);
        target.setUTCHours(0, 0, 0, 0);

        const current = new Date();
        current.setUTCHours(0, 0, 0, 0);

        const diffTime = Math.abs(current.getTime() - target.getTime());
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays === 2) return "2 Days Ago";
        return target.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    // Filter/deduplicate playlists by their relative day label, keeping the latest one for each unique label
    const filteredPlaylists: PlaylistRecord[] = [];
    const seenLabels = new Set<string>();
    for (const playlist of playlists) {
        const label = getRelativeDayLabel(playlist.created_at);
        if (!seenLabels.has(label)) {
            seenLabels.add(label);
            filteredPlaylists.push(playlist);
        }
    }

    // Limit displayed playlists to at most 3 unique dates (Today and the 2 latest previous dates)
    const displayedPlaylists = filteredPlaylists.slice(0, 3);

    const activePlaylist = displayedPlaylists[activeIndex] || displayedPlaylists[0];
    const mappedTracks = activePlaylist.audio_urls.map((url: string, idx: number) => ({
        id: `${activePlaylist.created_at}-${idx}`,
        url,
        articleId: 0
    }));

    return (
        <div className="w-full flex flex-col items-center justify-center">
            
            {/* Sleek Glassmorphic Historical Sub-Navigation Tab Bar */}
            <div className="flex items-center gap-1.5 bg-white/[0.03] backdrop-blur-xl border border-white/10 p-1.5 rounded-full mb-10 shadow-2xl shadow-black/40 relative z-20">
                {displayedPlaylists.map((playlist, index) => {
                    const isActive = index === activeIndex;
                    return (
                        <button
                            key={playlist.created_at}
                            onClick={() => setActiveIndex(index)}
                            className={`px-5 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 ${
                                isActive 
                                ? 'bg-gradient-to-r from-cyan-500/25 to-blue-500/25 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.25)] border border-cyan-400/40 ring-1 ring-cyan-400/20' 
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] border border-transparent'
                            }`}
                        >
                            {getRelativeDayLabel(playlist.created_at)}
                        </button>
                    );
                })}
            </div>

            {/* Force component remount upon playlist pivot by utilizing key prop */}
            <div key={activePlaylist.created_at} className="w-full flex flex-col items-center animate-in fade-in zoom-in duration-500">
                <AudioPlayer userId={userId} tracks={mappedTracks} />
            </div>

        </div>
    );
}
