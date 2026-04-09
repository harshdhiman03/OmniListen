"use client";

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import * as Slider from '@radix-ui/react-slider';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';

export default function AuraVisualizer() {
    const { 
        analyser, 
        isPlaying, 
        playPause, 
        skipBackward10, 
        skipForward10, 
        playbackRate, 
        setSpeed,
        globalCurrentTime,
        globalDuration,
        seek
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

            // Dynamically calculate the average force of the audio stream
            // We focus purely on the lower 1/3 hardware bins because human speech/AI voices
            // naturally resonate best in the lower-mid spectrum rather than high-treble white noise
            const activeBins = Math.floor(bufferLength / 3);
            let sum = 0;
            for (let i = 0; i < activeBins; i++) {
                sum += dataArray[i];
            }
            
            const average = sum / activeBins;
            
            // Linear interpolation to natively smooth out jittery UI hardware jumps
            setAverageFrequency(prev => prev + (average - prev) * 0.4);
        };

        renderFrame();

        // Anti-leak cleanup explicitly detached on unmount
        return () => cancelAnimationFrame(animationId);
    }, [analyser]);

    /* Math Execution Matrix */
    // Map the 0-255 average frequency into safe UI scale multipliers (1.0 => 1.4 max)
    const scale = 1 + (averageFrequency / 255) * 0.4;
    
    // Map glowing volumetric spread mapping (0px => 40px modifier)
    const glowSpread = (averageFrequency / 255) * 40; 
    
    // Explicit dynamic Box-Shadow generation for smooth radial bleed
    const dynamicBoxShadow = `0 0 ${25 + glowSpread}px ${10 + glowSpread}px rgba(6, 182, 212, ${0.3 + (averageFrequency / 255) * 0.3})`;
    const relaxedBoxShadow = `0 0 20px 10px rgba(6, 182, 212, 0.2)`;


    // Sleek Cyclical Speed Engine
    const speeds = [0.5, 0.75, 1, 1.25, 1.5];
    const cycleSpeed = () => {
        const currentIndex = speeds.indexOf(playbackRate);
        const nextIndex = (currentIndex + 1) % speeds.length;
        setSpeed(speeds[nextIndex]);
    };

    return (
        <div className="flex flex-col items-center w-full max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 mt-4">
            
            {/* Premium Glassmorphic Central Card Base */}
            <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.4)] flex flex-col relative overflow-hidden group">
                
                {/* Aesthetic atmospheric noise overlay confined to the card */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0 mix-blend-overlay" />

                {/* The Fluid Breathing Aura Space */}
                <div className="w-full h-48 relative flex items-center justify-center -mt-4">
                    {/* Framer Motion AI Orb Engine */}
                    <motion.div
                        animate={{ 
                            scale: isPlaying ? scale : 1,
                            boxShadow: isPlaying ? dynamicBoxShadow : relaxedBoxShadow
                        }}
                        transition={{ 
                            type: 'spring', 
                            stiffness: 120, 
                            damping: 15,    
                            mass: 0.8
                        }}
                        className="w-24 h-24 rounded-full bg-[radial-gradient(circle_at_center,_#06b6d4_0%,_#3b82f6_100%)] z-10"
                    />
                </div>

                {/* Ultra-Minimalist Radix Slider Hover Deck */}
                <div className="relative w-full z-20 group/slider mt-2">
                    <Slider.Root 
                        className="relative flex items-center select-none touch-none w-full h-6 cursor-pointer"
                        value={[globalCurrentTime]}
                        max={globalDuration > 0 ? globalDuration : 100}
                        step={0.1}
                        onValueChange={(val: number[]) => seek(val[0])}
                    >
                        <Slider.Track className="bg-white/10 relative grow rounded-full h-1">
                            <Slider.Range className="absolute bg-cyan-400 rounded-full h-full shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
                        </Slider.Track>
                        <Slider.Thumb 
                            className="block w-4 h-4 bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)] rounded-full focus:outline-none opacity-0 group-hover/slider:opacity-100 transition-opacity duration-300"
                            aria-label="Seek time"
                        />
                    </Slider.Root>
                    
                    {/* Timestamp Injectors */}
                    <div className="flex justify-between text-[10px] text-gray-500/80 mt-1 font-bold tracking-widest uppercase opacity-0 group-hover/slider:opacity-100 transition-opacity duration-300">
                        <span>{Math.floor(globalCurrentTime / 60)}:{(Math.floor(globalCurrentTime % 60)).toString().padStart(2, '0')}</span>
                        <span>{Math.floor(globalDuration / 60)}:{(Math.floor(globalDuration % 60)).toString().padStart(2, '0')}</span>
                    </div>
                </div>

                {/* Dashboard Controls */}
                <div className="flex items-center justify-between w-full mt-6 relative z-20 px-2">
                    
                    {/* Ghost item to balance the flex space-between */}
                    <div className="w-[50px]"></div>

                    {/* Primary Playback Deck */}
                    <div className="flex items-center gap-6">
                        <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={skipBackward10}
                            className="p-3 text-gray-400 hover:text-white transition-colors focus:outline-none rounded-full"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" /></svg>
                        </motion.button>

                        <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={playPause}
                            className="w-16 h-16 flex items-center justify-center bg-gradient-to-tr from-cyan-400 to-blue-600 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_35px_rgba(6,182,212,0.6)] transition-all text-white focus:outline-none focus:ring-4 focus:ring-cyan-500/20"
                        >
                            {isPlaying ? (
                                <svg className="w-7 h-7 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                            ) : (
                                <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            )}
                        </motion.button>

                        <motion.button 
                            whileTap={{ scale: 0.9 }}
                            onClick={skipForward10}
                            className="p-3 text-gray-400 hover:text-white transition-colors focus:outline-none rounded-full"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" /></svg>
                        </motion.button>
                    </div>
                    
                    {/* Playback Rate Cycler Frosted Pill Badge */}
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={cycleSpeed}
                        className="w-[50px] py-1.5 flex justify-center items-center text-[11px] font-bold font-mono tracking-wider text-cyan-300 bg-white/10 hover:bg-white/20 transition-all rounded-full focus:outline-none"
                    >
                        {playbackRate}X
                    </motion.button>

                </div>
            </div>
        </div>
    );
}
