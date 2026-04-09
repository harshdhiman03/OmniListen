"use client";

import React, { useEffect, useRef } from 'react';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';

export default function FrequencyVisualizer() {
    const { 
        analyser, 
        isPlaying, 
        playPause, 
        skipBackward10, 
        skipForward10, 
        playbackRate, 
        setSpeed 
    } = useAudioPlayer();

    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Audio Visualizer Hardware Loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !analyser) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Ensure crisp internal retina canvas scaling
        canvas.width = canvas.offsetWidth * 2;
        canvas.height = canvas.offsetHeight * 2;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let animationId: number;

        const draw = () => {
            animationId = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Display a selective chunk of frequencies optimized for voice/speech patterns
            const displayBins = 64; 
            const totalWidth = canvas.width;
            
            const barWidth = (totalWidth / displayBins) * 0.7;
            const gap = (totalWidth / displayBins) * 0.3;
            let x = 0;

            const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
            gradient.addColorStop(0, '#06b6d4'); // Cyan-400
            gradient.addColorStop(1, '#3b82f6'); // Blue-500

            for (let i = 0; i < displayBins; i++) {
                // Focus slightly on the lower-mid vocal frequencies rather than pure noise treble
                const value = dataArray[i]; 
                const percentage = value / 255;
                const barHeight = Math.max(percentage * canvas.height, 4); // Keep minimum 4px height when idle
                
                ctx.fillStyle = gradient;
                
                // Natively round the top edge of the Frequency Bars
                ctx.beginPath();
                ctx.roundRect(x, canvas.height - barHeight, barWidth, barHeight, [10, 10, 0, 0]);
                ctx.fill();

                x += barWidth + gap;
            }
        };

        draw();

        // Memory leak cleanup explicitly detached on unmount
        return () => {
            cancelAnimationFrame(animationId);
        };
    }, [analyser]);

    // Sleek Cyclical Speed Engine
    const speeds = [0.5, 0.75, 1, 1.25, 1.5];
    const cycleSpeed = () => {
        const currentIndex = speeds.indexOf(playbackRate);
        const nextIndex = (currentIndex + 1) % speeds.length;
        setSpeed(speeds[nextIndex]);
    };

    return (
        <div className="flex flex-col items-center w-full max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {/* Visualizer Glassmorphic Canvas Host */}
            <div className="w-full h-36 bg-gray-900/60 rounded-3xl border border-white/5 overflow-hidden backdrop-blur-md p-5 pb-0 relative shadow-[0_0_40px_rgba(0,0,0,0.5)] group transform transition-all duration-500 hover:border-white/10 hover:bg-gray-900/70">
                <canvas 
                    ref={canvasRef} 
                    className="w-full h-full opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                />
                
                {/* Aesthetic bottom edge blur to ground the visualizer */}
                <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none" />
            </div>

            {/* Interaction Dashboard Controls */}
            <div className="flex items-center justify-between w-full px-6">
                
                {/* 1. Playback Engine Rate Tool */}
                <button
                    onClick={cycleSpeed}
                    className="w-[70px] h-[36px] flex items-center justify-center text-[13px] font-bold font-mono tracking-widest text-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/60 hover:text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/40 rounded-full transition-all duration-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] active:scale-95 focus:outline-none"
                    aria-label="Toggle Playback Speed"
                >
                    {playbackRate}X
                </button>

                {/* 2. Primary Playback Manipulation Deck */}
                <div className="flex items-center gap-5">
                    {/* Reverse Time Vector */}
                    <button 
                        onClick={skipBackward10}
                        className="p-3 text-gray-500 hover:text-white transition-colors transform hover:-translate-x-1 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-cyan-500/50 rounded-full"
                        aria-label="Skip backward 10 seconds"
                    >
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                        </svg>
                    </button>

                    {/* Hardware Ignition Trigger */}
                    <button 
                        onClick={playPause}
                        className="w-[72px] h-[72px] flex items-center justify-center bg-gradient-to-br from-cyan-400 to-blue-600 rounded-full shadow-[0_0_25px_rgba(6,182,212,0.4)] hover:shadow-[0_0_40px_rgba(6,182,212,0.6)] transform hover:scale-105 active:scale-95 transition-all duration-300 border border-white/20 text-white focus:outline-none focus:ring-4 focus:ring-cyan-500/30"
                        aria-label={isPlaying ? "Pause audio" : "Play audio"}
                    >
                        {isPlaying ? (
                            <svg className="w-8 h-8 ml-0.5 mt-0.5 opacity-90" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                        ) : (
                            <svg className="w-9 h-9 ml-1.5 opacity-90" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        )}
                    </button>

                    {/* Advance Time Vector */}
                    <button 
                        onClick={skipForward10}
                        className="p-3 text-gray-500 hover:text-white transition-colors transform hover:translate-x-1 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-cyan-500/50 rounded-full"
                        aria-label="Skip forward 10 seconds"
                    >
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                        </svg>
                    </button>
                </div>
                
                {/* 3. Empty Invisible Balancing Ghost */}
                {/* This natively ensures flex space-between flawlessly centers the central deck! */}
                <div className="w-[70px]"></div>
            </div>
        </div>
    );
}
