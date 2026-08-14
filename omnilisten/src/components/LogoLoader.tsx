'use client';

import React from 'react';
import Image from 'next/image';

interface LogoLoaderProps {
  message?: string;
  fullScreen?: boolean;
}

export default function LogoLoader({ message = "Loading Neural Briefing...", fullScreen = true }: LogoLoaderProps) {
  const containerClasses = fullScreen
    ? "fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-2xl transition-all duration-500"
    : "w-full py-12 flex flex-col items-center justify-center backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8";

  return (
    <div className={containerClasses}>
      <div className="relative flex items-center justify-center mb-6">
        {/* Outer Spinning Cyan Glow Ring */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-transparent border-t-cyan-400 border-r-sky-500 border-b-cyan-500/30 animate-spin shadow-[0_0_30px_rgba(6,182,212,0.3)]" />
        
        {/* Counter-Spinning Inner Ring */}
        <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-sky-300 border-l-cyan-400 opacity-60 animate-[spin_2s_linear_infinite_reverse]" />

        {/* Central Glowing OmniListen Brand Logo */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-16 h-16 sm:w-18 sm:h-18 flex items-center justify-center rounded-[32px] sm:rounded-[36px] bg-black/80 border-2 border-cyan-500/50 p-0.5 shadow-[0_0_25px_rgba(6,182,212,0.5)] animate-pulse">
            <Image 
              src="/omnilogo.png" 
              alt="OmniListen Logo" 
              width={68} 
              height={68} 
              className="w-full h-full object-contain rounded-full drop-shadow-[0_0_20px_rgba(6,182,212,0.95)] drop-shadow-[0_0_35px_rgba(6,182,212,0.7)]"
              priority
            />
          </div>
        </div>
      </div>

      {/* Futuristic Status Message */}
      {message && (
        <p className="text-xs sm:text-sm font-semibold tracking-widest bg-gradient-to-r from-cyan-300 via-sky-200 to-white bg-clip-text text-transparent uppercase animate-pulse text-center px-4">
          {message}
        </p>
      )}
    </div>
  );
}
