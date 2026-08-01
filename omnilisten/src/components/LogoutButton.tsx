"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { motion } from 'framer-motion';

/**
 * Production-ready Glassmorphic Logout Button Component.
 * Integrates secure Supabase authentication teardown, active audio engine cleanup,
 * localStorage/sessionStorage purges, and native Next.js router transitions.
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
            console.error("Auth teardown network warning, executing aggressive offline purge:", error);
        } finally {
            // 3. Robust Offline Teardown Failsafe (always executes)
            try {
                if (typeof window !== 'undefined') {
                    // Wipe OAuth tokens, session states, and cached profiles
                    localStorage.clear();
                    sessionStorage.clear();

                    // Optional: Clear client cookies specifically related to auth
                    document.cookie.split(";").forEach((cookie) => {
                        const eqPos = cookie.indexOf("=");
                        const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
                        // Nuke cookie
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
            whileHover={{ scale: 1.04, backgroundColor: "rgba(239, 68, 68, 0.08)", borderColor: "rgba(239, 68, 68, 0.3)" }}
            whileTap={{ scale: 0.96 }}
            className={`
                flex items-center gap-2.5 px-4 py-2 text-sm font-medium tracking-wide
                text-gray-400 hover:text-red-400
                bg-white/[0.03] hover:bg-red-500/[0.08]
                backdrop-blur-md border border-white/5 hover:border-red-500/20
                rounded-full shadow-lg shadow-black/20
                transition-colors duration-300 select-none
                focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 focus:ring-offset-black
                ${isLoggingOut ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
            `}
            title="Sign Out"
        >
            {isLoggingOut ? (
                // Smooth Glassmorphic Spinner
                <svg 
                    className="animate-spin h-4.5 w-4.5 text-red-400" 
                    fill="none" 
                    viewBox="0 0 24 24"
                    aria-label="Logging out spinner"
                >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
            ) : (
                // Minimalist Box-Arrow-Right/Logout Icon
                <svg 
                    className="w-4.5 h-4.5" 
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
