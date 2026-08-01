"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { motion } from 'framer-motion';

/**
 * Production-ready Glassmorphic Logout Button Component.
 * Unified glassmorphic styling (bg-white/[0.04], backdrop-blur-md, border border-white/10).
 */
export default function LogoutButton() {
    const router = useRouter();
    const { stopAll } = useAudioEngine();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        if (isLoggingOut) return;
        setIsLoggingOut(true);

        try {
            // 1. Instantly halt all dual audio buffer playback globally
            stopAll();

            // 2. Perform Supabase Sign Out Teardown
            const supabase = createClient();
            
            // Wrap network signOut in a timed promise to prevent infinite waiting on bad connections
            await Promise.race([
                supabase.auth.signOut(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Sign out network timeout')), 5000))
            ]);

        } catch (error) {
            console.error("Auth teardown network warning, executing offline purge:", error);
        } finally {
            // 3. Offline Teardown Failsafe
            try {
                if (typeof window !== 'undefined') {
                    localStorage.clear();
                    sessionStorage.clear();
                    document.cookie.split(";").forEach((cookie) => {
                        const eqPos = cookie.indexOf("=");
                        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
                        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                    });
                }
            } catch (cleanupErr) {
                console.error("Local storage/cookie purge failed:", cleanupErr);
            }

            // 4. Clear route caches and redirect
            router.refresh();
            router.push('/login');
        }
    };

    return (
        <motion.button
            onClick={handleLogout}
            disabled={isLoggingOut}
            whileHover={{ scale: 1.04, backgroundColor: "rgba(239, 68, 68, 0.12)", borderColor: "rgba(239, 68, 68, 0.35)" }}
            whileTap={{ scale: 0.96 }}
            className={`
                flex items-center gap-2 px-3.5 py-2 text-xs font-semibold tracking-wide
                text-zinc-300 hover:text-red-400
                bg-white/[0.04] hover:bg-red-500/10
                backdrop-blur-md border border-white/10 hover:border-red-500/30
                rounded-full shadow-lg shadow-black/20
                transition-all duration-300 select-none
                focus:outline-none focus:ring-2 focus:ring-red-500/40
                ${isLoggingOut ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
            `}
            title="Sign Out"
        >
            {isLoggingOut ? (
                <svg 
                    className="animate-spin h-3.5 w-3.5 text-red-400" 
                    fill="none" 
                    viewBox="0 0 24 24"
                    aria-label="Logging out spinner"
                >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            ) : (
                <svg 
                    className="w-3.5 h-3.5" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
            )}
            <span>{isLoggingOut ? "Signing Out..." : "Sign Out"}</span>
        </motion.button>
    );
}
