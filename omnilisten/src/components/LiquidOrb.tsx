"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
    
    // Internal tracker for the aggregated frequency volume (0 - 255)
    const [averageFrequency, setAverageFrequency] = useState(0);

    // Audio Visualizer Hardware Loop
    useEffect(() => {
        if (!analyser) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        let animationId: number;

        const renderFrame = () => {
            animationId = requestAnimationFrame(renderFrame);
            analyser.getByteFrequencyData(dataArray);

            const activeBins = Math.floor(bufferLength / 3);
            let sum = 0;
            for (let i = 0; i < activeBins; i++) {
                sum += dataArray[i];
            }
            
            const average = sum / activeBins;
            setAverageFrequency(prev => prev + (average - prev) * 0.4);
        };

        renderFrame();
        return () => cancelAnimationFrame(animationId);
    }, [analyser]);

    /* Math Execution Matrix */
    const scale = 1 + (averageFrequency / 255) * 0.55;
    const glowSpread = (averageFrequency / 255) * 70; 
    
    // Explicit dynamic Box-Shadow generation for 3D liquid glass highlights and drop shadow!
    const dynamicBoxShadow = `
        inset 15px 15px 30px rgba(255, 255, 255, 0.5), 
        inset -15px -15px 30px rgba(0, 0, 0, 0.4), 
        0 0 ${40 + glowSpread}px ${10 + glowSpread}px rgba(6, 182, 212, ${0.4 + (averageFrequency / 255) * 0.4})
    `;
    
    const relaxedBoxShadow = `
        inset 10px 10px 25px rgba(255, 255, 255, 0.3), 
        inset -10px -10px 25px rgba(0, 0, 0, 0.4), 
        0 0 30px 10px rgba(6, 182, 212, 0.15)
    `;

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
            <div className="w-full flex flex-col items-center relative group min-h-[380px] justify-between">


                {/* The Fluid Breathing Aura Space */}
                <div className="w-full h-full relative flex flex-1 items-center justify-center pt-6 pb-12 z-10">
                    
                    {/* Native Liquid Glass AI Morphing Droplet */}
                    <motion.div
                        animate={{ 
                            scale: isPlaying ? scale : [1, 1.03, 1],
                            boxShadow: isPlaying ? dynamicBoxShadow : relaxedBoxShadow,
                            borderRadius: ["60% 40% 30% 70%/60% 30% 70% 40%", "30% 70% 70% 30%/30% 30% 70% 70%", "50% 50% 20% 80%/25% 80% 20% 75%", "60% 40% 30% 70%/60% 30% 70% 40%"]
                        }}
                        transition={{ 
                            scale: isPlaying ? { type: 'spring', stiffness: 100, damping: 10, mass: 0.7 } : { duration: 4, repeat: Infinity, ease: "easeInOut" },
                            boxShadow: { type: 'spring', stiffness: 100, damping: 12 },
                            borderRadius: { duration: 6, repeat: Infinity, ease: "easeInOut" }
                        }}
                        className="w-36 h-36 rounded-full bg-gradient-to-br from-cyan-400/80 to-blue-600/80 backdrop-blur-md"
                    />
                </div>

                {/* Minimalist Dashboard Controls Native Hardware Hook */}
                <div className="flex justify-center w-full relative z-20 pb-4">
                    
                    {/* Floating Controls Container */}
                    <div className="flex items-center px-6 py-3 space-x-6">
                        
                        {/* Ghost symmetry block to balance the explicit far-right badge */}
                        <div className="w-[45px]"></div>

                        {/* Flanking Left: Skip Back */}
                        <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={skipBackward10}
                            className="p-2 text-white/50 hover:text-cyan-400 transition-colors focus:outline-none rounded-full"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg>
                        </motion.button>

                        {/* Prominent Center: Play / Pause */}
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

                        {/* Far Right Badge: Playback Speed Cycler */}
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
