"use client";

import React, { useState, useRef, useEffect } from 'react';

// Upgraded props to allow associating track URLs with specific article IDs for telemetry
export interface AudioTrack {
    url: string;
    articleId: number;
}

interface AudioPlayerProps {
    userId: string;
    tracks: AudioTrack[];
}

export default function AudioPlayer({ userId, tracks }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState("0:00");
    const [duration, setDuration] = useState("0:00");

    useEffect(() => {
        setProgress(0);
        setCurrentTime("0:00");
        
        if (audioRef.current && isPlaying) {
            audioRef.current.play().catch(console.error);
        }
    }, [currentIndex]);

    /**
     * Asynchronously posts tracking data to the new Next.js telemetry route.
     * Captures user engagement for personalized matching later.
     */
    const logTelemetry = async (action_type: string, duration_listened: number) => {
        try {
            if (!tracks[currentIndex]) return;
            const articleId = tracks[currentIndex].articleId;

            await fetch('/api/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    article_id: articleId,
                    action_type,
                    duration_listened_seconds: Math.floor(duration_listened)
                })
            });
        } catch (err) {
            console.error("Failed to log telemetry", err);
        }
    };

    const handlePlayPause = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(console.error);
        }
        setIsPlaying(!isPlaying);
    };

    const handleSkip = () => {
        if (!audioRef.current) return;
        const currentListeningTime = audioRef.current.currentTime;
        
        // Granular Telemetry: Explicitly log skips performed within the first 10 seconds.
        if (currentListeningTime < 10) {
            logTelemetry("skip", currentListeningTime);
        } else {
            // Alternatively, classify later skips as partial listens
            logTelemetry("partial", currentListeningTime);
        }

        if (currentIndex < tracks.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            // End of playlist
            setIsPlaying(false);
            setCurrentIndex(0);
        }
    };

    const handleEnded = () => {
        if (!audioRef.current) return;
        
        // Granular Telemetry: Log completions unconditionally when track ends.
        logTelemetry("completed", audioRef.current.currentTime);

        if (currentIndex < tracks.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setIsPlaying(false);
            setCurrentIndex(0);
        }
    };

    const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        const current = audioRef.current.currentTime;
        const dur = audioRef.current.duration || 0;
        
        if (dur > 0) {
            setProgress((current / dur) * 100);
        }

        setCurrentTime(formatTime(current));
        setDuration(formatTime(dur));
    };

    const formatTime = (timeInSeconds: number) => {
        if (isNaN(timeInSeconds)) return "0:00";
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!audioRef.current) return;
        const seekPercentage = Number(e.target.value);
        const seekTime = (audioRef.current.duration * seekPercentage) / 100;
        audioRef.current.currentTime = seekTime;
        setProgress(seekPercentage);
    };

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
                    AI Podcast Stream
                </h3>
                <span className="px-3 py-1 rounded-full bg-white/5 text-xs text-cyan-400 font-semibold tracking-widest uppercase">
                    Part {currentIndex + 1} of {tracks.length}
                </span>
            </div>

            <audio 
                ref={audioRef}
                src={tracks[currentIndex].url}
                onEnded={handleEnded}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleTimeUpdate}
            />

            <div className="mb-8 group">
                <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={isNaN(progress) ? 0 : progress}
                    onChange={handleSeek}
                    className="w-full h-2 bg-gray-800 rounded-full appearance-none cursor-pointer accent-cyan-400 focus:outline-none transition-all group-hover:h-3"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-2 font-semibold tracking-wider">
                    <span>{currentTime}</span>
                    <span>{duration}</span>
                </div>
            </div>

            <div className="flex items-center justify-center gap-6">
                <button 
                    onClick={handlePlayPause}
                    className="w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_30px_rgba(6,182,212,0.3)] transform transition-transform duration-200 active:scale-95 focus:outline-none"
                    aria-label={isPlaying ? "Pause" : "Play"}
                >
                    {isPlaying ? (
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                    ) : (
                        <svg className="w-9 h-9 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                </button>

                <button 
                    onClick={handleSkip}
                    disabled={currentIndex === tracks.length - 1}
                    className={`w-12 h-12 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white transition-all duration-200 
                        ${currentIndex === tracks.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 hover:scale-110 active:scale-95'}`}
                    aria-label="Next Track"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                </button>
            </div>
        </div>
    );
}
