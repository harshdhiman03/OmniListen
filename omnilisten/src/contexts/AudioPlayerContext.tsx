"use client";

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

export interface AudioTrack {
    id: string;
    url: string;
    duration?: number;
    articleId?: number;
}

interface AudioPlayerContextType {
    isPlaying: boolean;
    activePlayer: 'A' | 'B';
    globalCurrentTime: number;
    globalDuration: number;
    currentIndex: number;
    tracks: AudioTrack[];
    playPause: () => void;
    skipNext: () => void;
    seek: (targetGlobalTime: number) => void;
    seekToPercentage: (percentage: number) => void;
    skipForward10: () => void;
    skipBackward10: () => void;
    playbackRate: number;
    setSpeed: (rate: number) => void;
    analyser: AnalyserNode | null;
    stopAll: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export function AudioPlayerProvider({ children, initialTracks }: { children: ReactNode, initialTracks: AudioTrack[] }) {
    const playerA = useRef<HTMLAudioElement | null>(null);
    const playerB = useRef<HTMLAudioElement | null>(null);
    const audioContext = useRef<AudioContext | null>(null);
    const analyser = useRef<AnalyserNode | null>(null);
    const [analyserState, setAnalyserState] = useState<AnalyserNode | null>(null);
    const audioGraphInitialized = useRef(false);

    const [isPlaying, setIsPlaying] = useState(false);
    const [activePlayer, setActivePlayer] = useState<'A' | 'B'>('A');
    const [globalCurrentTime, setGlobalCurrentTime] = useState(0);
    const [globalDuration, setGlobalDuration] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1.0);

    const activePlayerRef = useRef<'A' | 'B'>('A');
    const currentIndexRef = useRef(0);
    const globalCurrentTimeRef = useRef(0);
    const playbackRateRef = useRef(1.0);
    const preloadedIndexRef = useRef<number | null>(null);
    const tracksRef = useRef<AudioTrack[]>(initialTracks);

    useEffect(() => { activePlayerRef.current = activePlayer; }, [activePlayer]);
    useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
    useEffect(() => { tracksRef.current = initialTracks; }, [initialTracks]);
    useEffect(() => { globalCurrentTimeRef.current = globalCurrentTime; }, [globalCurrentTime]);
    
    // Playback Rate synchronization engine
    useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);
    
    useEffect(() => {
        if (playerA.current && playerB.current) {
            playerA.current.playbackRate = playbackRate;
            playerB.current.playbackRate = playbackRate;
            playerA.current.preservesPitch = true;
            playerB.current.preservesPitch = true;
        }
    }, [playbackRate]);

    const setSpeed = (rate: number) => {
        setPlaybackRate(rate);
    };

    // MediaSession API Integration for Lockscreen & Bluetooth Hardware Controls
    useEffect(() => {
        if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: 'Daily AI Briefing',
                artist: 'OmniListen',
                album: 'Personalized News Audiobook',
                artwork: [
                    { src: '/favicon.ico', sizes: '96x96', type: 'image/x-icon' }
                ]
            });

            try {
                navigator.mediaSession.setActionHandler('play', () => {
                    const activeHtml = activePlayerRef.current === 'A' ? playerA.current : playerB.current;
                    activeHtml?.play().catch(console.error);
                    setIsPlaying(true);
                });
                navigator.mediaSession.setActionHandler('pause', () => {
                    const activeHtml = activePlayerRef.current === 'A' ? playerA.current : playerB.current;
                    activeHtml?.pause();
                    setIsPlaying(false);
                });
                navigator.mediaSession.setActionHandler('seekbackward', () => skipBackward10());
                navigator.mediaSession.setActionHandler('seekforward', () => skipForward10());
                navigator.mediaSession.setActionHandler('previoustrack', () => skipBackward10());
                navigator.mediaSession.setActionHandler('nexttrack', () => skipNext());
            } catch (e) {
                console.warn("MediaSession action handler error:", e);
            }
        }
    }, []);

    useEffect(() => {
        if (!playerA.current && !playerB.current) {
            playerA.current = new Audio();
            playerB.current = new Audio();
            playerA.current.crossOrigin = "anonymous";
            playerB.current.crossOrigin = "anonymous";
            
            if (initialTracks.length > 0) {
                playerA.current.src = initialTracks[0].url;
                playerA.current.load();
            }

            const timeUpdateDispatcher = () => {
                const activeHtml = activePlayerRef.current === 'A' ? playerA.current : playerB.current;
                const inactiveHtml = activePlayerRef.current === 'A' ? playerB.current : playerA.current;
                
                if (!activeHtml || !inactiveHtml) return;

                // Dynamically intercept and patch raw browser metadata to simulate a unified global timeline
                if (!tracksRef.current[currentIndexRef.current]?.duration && activeHtml.duration) {
                    tracksRef.current[currentIndexRef.current].duration = activeHtml.duration;
                }

                // Calculate global pipeline variables natively
                const localCurrent = activeHtml.currentTime || 0;
                const preceedingDuration = tracksRef.current.slice(0, currentIndexRef.current).reduce((acc, tr) => acc + (tr.duration || 0), 0);
                const totalDur = tracksRef.current.reduce((acc, tr) => acc + (tr.duration || 0), 0);
                
                setGlobalCurrentTime(preceedingDuration + localCurrent);
                setGlobalDuration(totalDur);

                // Hardware Lookahead Preloading Engine (< 5s lookahead boundary)
                const timeLeft = activeHtml.duration - activeHtml.currentTime;
                const nextInd = currentIndexRef.current + 1;
                
                if (timeLeft < 5 && nextInd < tracksRef.current.length && preloadedIndexRef.current !== nextInd) {
                    preloadedIndexRef.current = nextInd;
                    inactiveHtml.src = tracksRef.current[nextInd].url;
                    inactiveHtml.load();
                }
            };

            const endedDispatcher = () => {
                const nextInd = currentIndexRef.current + 1;
                const tracks = tracksRef.current;
                
                if (nextInd < tracks.length) {
                    const inactiveHtml = activePlayerRef.current === 'A' ? playerB.current : playerA.current;
                    if (!inactiveHtml) return;

                    setCurrentIndex(nextInd);
                    if (inactiveHtml.src === '' || !inactiveHtml.src.includes(tracks[nextInd].url)) {
                        inactiveHtml.src = tracks[nextInd].url;
                    }

                    // Hardware override: Browsers occasionally wipe configured context settings when src changes!
                    inactiveHtml.playbackRate = playbackRateRef.current;
                    inactiveHtml.preservesPitch = true;

                    inactiveHtml.play().catch(console.error);
                    
                    setActivePlayer(activePlayerRef.current === 'A' ? 'B' : 'A');
                    preloadedIndexRef.current = null;
                } else {
                    setIsPlaying(false);
                    setCurrentIndex(0);
                    if (playerA.current) {
                        playerA.current.src = tracks[0].url;
                        playerA.current.load();
                    }
                    setActivePlayer('A');
                    setGlobalCurrentTime(0);
                }
            };

            playerA.current.addEventListener('timeupdate', () => activePlayerRef.current === 'A' && timeUpdateDispatcher());
            playerB.current.addEventListener('timeupdate', () => activePlayerRef.current === 'B' && timeUpdateDispatcher());
            
            playerA.current.addEventListener('loadedmetadata', () => activePlayerRef.current === 'A' && timeUpdateDispatcher());
            playerB.current.addEventListener('loadedmetadata', () => activePlayerRef.current === 'B' && timeUpdateDispatcher());

            playerA.current.addEventListener('ended', () => activePlayerRef.current === 'A' && endedDispatcher());
            playerB.current.addEventListener('ended', () => activePlayerRef.current === 'B' && endedDispatcher());
        }

        return () => {
            playerA.current?.pause();
            playerB.current?.pause();
            audioContext.current?.close();
        }
    }, [initialTracks]);

    // Core System Method: Advanced Virtual Timeline Mathematics
    const seek = (targetGlobalTime: number) => {
        let sum = 0;
        let targetIndex = 0;
        let localTimeOffset = 0;
        const tracks = tracksRef.current;
        
        // Find which chunk index the targetGlobalTime falls into
        for (let i = 0; i < tracks.length; i++) {
            const trackDur = tracks[i].duration || 0;
            // Provide a graceful fallback to the final track index if math exceeds bounds
            if (targetGlobalTime <= sum + trackDur || i === tracks.length - 1) {
                targetIndex = i;
                localTimeOffset = Math.max(0, targetGlobalTime - sum);
                break;
            }
            sum += trackDur;
        }

        const activeHtml = activePlayerRef.current === 'A' ? playerA.current : playerB.current;
        const inactiveHtml = activePlayerRef.current === 'A' ? playerB.current : playerA.current;
        
        if (!activeHtml || !inactiveHtml) return;

        // Execution Routing Matrix
        if (targetIndex === currentIndexRef.current) {
            // Internal track fast-forward
            activeHtml.currentTime = localTimeOffset;
        } else {
            // External track chunk jump!
            activeHtml.pause();
            
            // Synchronously update refs before state setter flushes
            setCurrentIndex(targetIndex);
            currentIndexRef.current = targetIndex;
            
            inactiveHtml.src = tracks[targetIndex].url;
            inactiveHtml.load();
            
            inactiveHtml.oncanplay = () => {
                inactiveHtml.currentTime = localTimeOffset;
                if (isPlaying) {
                    inactiveHtml.play().catch(console.error);
                }
                inactiveHtml.oncanplay = null; // Cleanup memory
            };
            
            const nextPlayerID = activePlayerRef.current === 'A' ? 'B' : 'A';
            setActivePlayer(nextPlayerID);
            activePlayerRef.current = nextPlayerID; 
            
            preloadedIndexRef.current = null;
        }

        setGlobalCurrentTime(targetGlobalTime);
    };

    const skipForward10 = () => seek(globalCurrentTimeRef.current + 10);
    const skipBackward10 = () => seek(Math.max(0, globalCurrentTimeRef.current - 10));

    const seekToPercentage = (percentage: number) => {
        const totalDur = tracksRef.current.reduce((acc, tr) => acc + (tr.duration || 0), 0);
        seek((totalDur * percentage) / 100);
    };

    const playPause = () => {
        const activeHtml = activePlayerRef.current === 'A' ? playerA.current : playerB.current;
        if (!activeHtml) return;

        if (!audioGraphInitialized.current) {
            audioContext.current = new window.AudioContext();
            analyser.current = audioContext.current.createAnalyser();
            analyser.current.fftSize = 2048;
            setAnalyserState(analyser.current);

            const sourceA = audioContext.current.createMediaElementSource(playerA.current!);
            const sourceB = audioContext.current.createMediaElementSource(playerB.current!);

            sourceA.connect(analyser.current);
            sourceB.connect(analyser.current);
            analyser.current.connect(audioContext.current.destination);
            
            audioGraphInitialized.current = true;
        }

        if (audioContext.current?.state === 'suspended') {
            audioContext.current.resume();
        }

        if (isPlaying) {
            activeHtml.pause();
        } else {
            activeHtml.play().catch(console.error);
        }
        setIsPlaying(!isPlaying);
    };

    const skipNext = () => {
        const activeHtml = activePlayerRef.current === 'A' ? playerA.current : playerB.current;
        if (activeHtml) {
            const preceeding = tracksRef.current.slice(0, currentIndexRef.current).reduce((acc, tr) => acc + (tr.duration || 0), 0);
            const thisDur = tracksRef.current[currentIndexRef.current]?.duration || 0;
            seek(preceeding + thisDur + 0.1); 
        }
    };

    const stopAll = () => {
        if (playerA.current) {
            playerA.current.pause();
            playerA.current.src = "";
        }
        if (playerB.current) {
            playerB.current.pause();
            playerB.current.src = "";
        }
        setIsPlaying(false);
        setGlobalCurrentTime(0);
    };

    return (
        <AudioPlayerContext.Provider
            value={{
                isPlaying,
                activePlayer,
                globalCurrentTime,
                globalDuration,
                currentIndex,
                tracks: initialTracks,
                playPause,
                skipNext,
                seek,
                seekToPercentage,
                skipForward10,
                skipBackward10,
                playbackRate,
                setSpeed,
                analyser: analyserState || analyser.current,
                stopAll
            }}
        >
            {children}
        </AudioPlayerContext.Provider>
    );
}

export function useAudioPlayer() {
    const context = useContext(AudioPlayerContext);
    if (!context) throw new Error("useAudioPlayer must be used inside an AudioPlayerProvider");
    return context;
}
