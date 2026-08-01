"use client";

import React, { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';

export default function LiquidOrb() {
    const { 
        analyser, 
        isPlaying, 
        playPause, 
        skipBackward10, 
        skipForward10, 
        playbackRate, 
        setSpeed 
    } = useAudioPlayer();
    
    // Direct GPU Motion Values (bypasses 60fps React state re-render thrashing)
    const rawScale = useMotionValue(1);
    const smoothScale = useSpring(rawScale, { stiffness: 120, damping: 25, mass: 0.5 });

    const rawIntensity = useMotionValue(0);
    const smoothIntensity = useSpring(rawIntensity, { stiffness: 90, damping: 20 });

    // Dynamic 3D Liquid Glass Box-Shadow mapped directly on GPU via Framer Motion useTransform!
    const dynamicBoxShadow = useTransform(smoothIntensity, (intensity) => {
        const glowSpread = Math.floor(10 + intensity * 40); // 10px to 50px max glow
        const glowBlur = Math.floor(30 + intensity * 35);   // 30px to 65px blur
        const opacity = (0.25 + intensity * 0.45).toFixed(2); // 0.25 to 0.70 opacity

        return `
            inset 15px 15px 30px rgba(255, 255, 255, 0.5), 
            inset -15px -15px 30px rgba(0, 0, 0, 0.4), 
            0 0 ${glowBlur}px ${glowSpread}px rgba(6, 182, 212, ${opacity})
        `;
    });

    // Smooth Hardware Audio Visualizer Loop
    useEffect(() => {
        if (!analyser || !isPlaying) {
            rawScale.set(1);
            rawIntensity.set(0);
            return;
        }

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let animationId: number;
        let smoothedAvg = 0;

        const renderFrame = () => {
            animationId = requestAnimationFrame(renderFrame);
            analyser.getByteFrequencyData(dataArray);

            const activeBins = Math.floor(bufferLength / 4);
            let sum = 0;
            for (let i = 0; i < activeBins; i++) {
                sum += dataArray[i];
            }
            
            const currentAvg = sum / activeBins;
            // Strong low-pass exponential smoothing (0.08) prevents rapid audio spikes from jerking the orb
            smoothedAvg += (currentAvg - smoothedAvg) * 0.08;

            // Clamped subtle scale (strictly between 1.0 and 1.15 max)
            const normalizedRatio = Math.min(1, Math.max(0, smoothedAvg / 255));
            const targetScale = 1 + normalizedRatio * 0.15;

            rawScale.set(targetScale);
            rawIntensity.set(normalizedRatio);
        };

        renderFrame();
        return () => cancelAnimationFrame(animationId);
    }, [analyser, isPlaying, rawScale, rawIntensity]);

    // Sleek Cyclical Speed Engine
    const speeds = [0.5, 0.75, 1, 1.25, 1.5];
    const cycleSpeed = () => {
        const currentIndex = speeds.indexOf(playbackRate);
        const nextIndex = (currentIndex + 1) % speeds.length;
        setSpeed(speeds[nextIndex]);
    };

    return (
        <div className="flex flex-col items-center w-full max-w-xl mx-auto animate-in fade-in zoom-in duration-1000">
            
            {/* Floating Layout Wrapper */}
            <div className="w-full flex flex-col items-center relative group min-h-[320px] justify-between">

                {/* The Fluid Breathing Aura Space */}
                <div className="w-full h-full relative flex flex-1 items-center justify-center pt-4 pb-8 z-10">
                    
                    {/* Controlled 3D Glass Morphing Orb with Dynamic Audio Glow */}
                    <motion.div
                        style={{
                            scale: smoothScale,
                            boxShadow: dynamicBoxShadow,
                        }}
                        animate={{ 
                            borderRadius: [
                                "60% 40% 30% 70%/60% 30% 70% 40%", 
                                "30% 70% 70% 30%/30% 30% 70% 70%", 
                                "50% 50% 20% 80%/25% 80% 20% 75%", 
                                "60% 40% 30% 70%/60% 30% 70% 40%"
                            ]
                        }}
                        transition={{ 
                            borderRadius: { duration: 8, repeat: Infinity, ease: "easeInOut" }
                        }}
                        className="w-36 h-36 rounded-full bg-gradient-to-br from-cyan-400/80 to-blue-600/80 backdrop-blur-md border border-white/30"
                    />
                </div>

                {/* Minimalist Dashboard Controls Native Hardware Hook */}
                <div className="flex justify-center w-full relative z-20 pb-4">
                    <div className="flex items-center px-6 py-3 space-x-6">
                        <div className="w-[45px]"></div>

                        {/* Flanking Left: Skip Back */}
                        <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={skipBackward10}
                            className="p-2 text-white/50 hover:text-cyan-400 transition-colors focus:outline-none rounded-full"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg>
                        </motion.button>

                        {/* Center Play / Pause */}
                        <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={playPause}
                            className="w-14 h-14 flex items-center justify-center bg-cyan-500 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all text-white focus:outline-none"
                        >
                            {isPlaying ? (
                                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                            ) : (
                                <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            )}
                        </motion.button>

                        {/* Flanking Right: Skip Forward */}
                        <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={skipForward10}
                            className="p-2 text-white/50 hover:text-cyan-400 transition-colors focus:outline-none rounded-full"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" /></svg>
                        </motion.button>

                        {/* Playback Speed Cycler */}
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={cycleSpeed}
                            className="w-[45px] py-1 text-[10px] font-bold font-mono tracking-wider text-white/70 bg-transparent rounded-full border border-white/20 hover:text-white hover:border-white/40 transition-colors focus:outline-none"
                        >
                            {playbackRate}X
                        </motion.button>
                    </div>
                </div>
            </div>
        </div>
    );
}
