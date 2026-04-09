"use client";

import React, { useEffect, useState, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface UnifiedAudioPlayerProps {
    playlistUrls: string[];
    userId?: string;
}

export default function UnifiedAudioPlayer({ playlistUrls, userId }: UnifiedAudioPlayerProps) {
    // Phase 1 Trackers
    const [stitchedAudioUrl, setStitchedAudioUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [playbackRate, setPlaybackRate] = useState<number>(1.0);
    
    // Hardware Graph Trackers (For future integration once package is installed)
    const waveformRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<any>(null); // Type 'any' for now to prevent typescript errors before Wavesurfer installs
    const furthestListenedTime = useRef<number>(0);
    const telemetrySent = useRef<boolean>(false);

    // Phase 2: Asynchronous Binary Stitching Engine
    useEffect(() => {
        let isMounted = true;

        const stitchAudioChunks = async () => {
            setIsLoading(true);
            try {
                // Fetch each MP3 file boundary perfectly via Promise.all mapping directly to raw ArrayBuffers
                const binaryBuffers = await Promise.all(
                    playlistUrls.map(async (url) => {
                        const response = await fetch(url);
                        if (!response.ok) throw new Error(`Failed to fetch chunk block: ${url}`);
                        return await response.arrayBuffer();
                    })
                );

                if (!isMounted) return;

                // Concatenate the raw binary array buffers directly into a single unified Blob Payload
                const combinedBlob = new Blob(binaryBuffers, { type: 'audio/mpeg' });
                
                // Mount the unified payload securely into a localized URI object for native decoding
                const temporaryBlobUrl = URL.createObjectURL(combinedBlob);
                setStitchedAudioUrl(temporaryBlobUrl);

            } catch (error) {
                console.error("Audio stitching compilation failed:", error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        if (playlistUrls && playlistUrls.length > 0) {
            stitchAudioChunks();
        } else {
            setIsLoading(false);
        }

        // Automated Memory Leak Garbage Collection
        return () => {
            isMounted = false;
            // Native revoke is required to completely destroy the memory pointer to the RAM blob
            if (stitchedAudioUrl) URL.revokeObjectURL(stitchedAudioUrl); 
        };
    }, [playlistUrls]); // Re-run native stitcher whenever playlistUrls structurally change


    // Phase 3: WaveSurfer DOM Mounting Sandbox
    useEffect(() => {
        // Halt rendering if the blob isn't structurally compiled yet, or if dom wrapper isn't mounted
        if (!stitchedAudioUrl || !waveformRef.current) return;

        // Reset trackers on new payload mount
        furthestListenedTime.current = 0;
        telemetrySent.current = false;

        wavesurferRef.current = WaveSurfer.create({
            container: waveformRef.current,
            url: stitchedAudioUrl,
            waveColor: '#1e293b',
            progressColor: '#06b6d4',
            barWidth: 2,
            barRadius: 2,
            cursorWidth: 0,
            height: 100
        });

        // 1. Isolated Telemetry Action Dispatcher
        const sendTelemetry = (action: 'skip' | 'completed') => {
            if (telemetrySent.current || !userId) return;
            telemetrySent.current = true;
            
            fetch('/api/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,
                    action_type: action,
                    duration_listened_seconds: Math.floor(furthestListenedTime.current)
                })
            }).catch(console.error);
        };

        // 2. Evaluator checking if listener exited prematurely ( < 20% duration )
        const checkSkipTelemetry = () => {
            if (!wavesurferRef.current) return;
            const duration = wavesurferRef.current.getDuration() || 0;
            if (duration > 0 && furthestListenedTime.current < 0.2 * duration) {
                sendTelemetry('skip');
            }
        };

        // 3. UI Component Lifecycle Syncer
        wavesurferRef.current.on('play', () => setIsPlaying(true));
        
        wavesurferRef.current.on('pause', () => {
            setIsPlaying(false);
            checkSkipTelemetry(); 
        });

        wavesurferRef.current.on('timeupdate', (currentTime: number) => {
            if (currentTime > furthestListenedTime.current) {
                furthestListenedTime.current = currentTime;
            }
        });

        // 4. Native Track Completion
        wavesurferRef.current.on('finish', () => {
            setIsPlaying(false);
            sendTelemetry('completed');
        });

        return () => {
            checkSkipTelemetry(); // Check if they ripped the component out before completion
            wavesurferRef.current?.destroy();
        };
    }, [stitchedAudioUrl, userId]);

    // Phase 4: Playback Rate & Pitch Preservation
    useEffect(() => {
        if (!wavesurferRef.current) return;
        // Set the playback rate and explicitly enforce native pitch preservation!
        wavesurferRef.current.setPlaybackRate(playbackRate, true);
    }, [playbackRate]);

    // Hardware UI Handlers
    const togglePlayPause = () => {
        wavesurferRef.current?.playPause();
    };

    const skipBackward10 = () => {
        wavesurferRef.current?.skip(-10);
    };

    const skipForward10 = () => {
        wavesurferRef.current?.skip(10);
    };

    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5];
    const cycleSpeed = () => {
        const nextIndex = (speeds.indexOf(playbackRate) + 1) % speeds.length;
        setPlaybackRate(speeds[nextIndex]);
    };

    return (
        <div className="flex flex-col items-center w-full max-w-2xl mx-auto space-y-6">
            <div className="w-full h-40 bg-gray-900/60 rounded-3xl border border-white/5 overflow-hidden backdrop-blur-md p-5 pb-0 shadow-[0_0_40px_rgba(0,0,0,0.5)] flex items-center justify-center">
                
                {/* 1. Loading Pulse Orchestrator */}
                {isLoading ? (
                    <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(6,182,212,0.4)] mb-4"></div>
                        <span className="text-sm font-semibold tracking-widest text-cyan-400 capitalize animate-pulse">
                            Stitching unified audio timeline...
                        </span>
                    </div>
                ) : (
                    /* 2. WaveSurfer Native Hardware DOM Anchor */
                    <div id="waveform" ref={waveformRef} className="w-full h-full opacity-90 transition-opacity duration-300 hover:opacity-100" />
                )}

            </div>
            
            {/* Example Hardware Integration Deck */}
            {stitchedAudioUrl && !isLoading && (
                <div className="flex items-center justify-between w-full px-6 bg-gray-900/60 border border-white/5 py-4 rounded-3xl backdrop-blur-md shadow-inner animate-in fade-in slide-in-from-bottom-2 duration-700">
                    
                    {/* Playback Rate Cycler */}
                    <button
                        onClick={cycleSpeed}
                        className="w-[70px] h-[36px] flex items-center justify-center text-[13px] font-bold font-mono tracking-widest text-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/60 transition-all rounded-full border border-cyan-500/20 hover:border-cyan-500/40 focus:outline-none hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-95"
                    >
                        {playbackRate}X
                    </button>

                    {/* Central Playback Deck */}
                    <div className="flex items-center gap-5">
                        <button 
                            onClick={skipBackward10}
                            className="p-3 text-gray-500 hover:text-white transition-colors transform hover:-translate-x-1 focus:outline-none rounded-full active:scale-95"
                        >
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg>
                        </button>

                        <button 
                            onClick={togglePlayPause}
                            className="w-[72px] h-[72px] flex items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:scale-105 active:scale-95 transition-all text-white focus:outline-none focus:ring-4 focus:ring-cyan-500/30"
                        >
                            {isPlaying ? (
                                <svg className="w-8 h-8 ml-0.5 opacity-90" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                            ) : (
                                <svg className="w-9 h-9 ml-1.5 opacity-90" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            )}
                        </button>

                        <button 
                            onClick={skipForward10}
                            className="p-3 text-gray-500 hover:text-white transition-colors transform hover:translate-x-1 focus:outline-none rounded-full active:scale-95"
                        >
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" /></svg>
                        </button>
                    </div>

                    {/* Invisible balancer for flex space-between */}
                    <div className="w-[70px]"></div>
                </div>
            )}
        </div>
    );
}
