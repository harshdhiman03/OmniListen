"use client";

import React, { useState } from 'react';
import { generateOnDemandBriefing } from '../app/dashboard/actions';
import DashboardRealtimeListener from './DashboardRealtimeListener';

export default function GenerateButton({ userId }: { userId: string }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        
        try {
            // Trigger the securely imported Next.js Server Action
            const result = await generateOnDemandBriefing(userId);
            
            if (!result.success) {
                setError(result.error || "Failed to enqueue the background process");
                setLoading(false); // We uniquely only stop loading if it natively fails!
            }
            
            // If it succeeds, we deliberately LEAVE loading=true!
            // The DashboardRealtimeListener injected below will automatically poll the DB 
            // and force the entire Server Component to re-render, organically unmounting this button 
            // and sliding the audio player into view without us ever dropping the loading spinner!

        } catch (err) {
            console.error(err);
            setError("A fatal network error occurred");
            setLoading(false);
        } 
    }

    return (
        <div className="flex flex-col items-center justify-center gap-4">
            {/* Invisible Async State Engine */}
            <DashboardRealtimeListener userId={userId} isGenerating={loading} />

            <button 
                onClick={handleGenerate} 
                disabled={loading} 
                className={`px-8 py-4 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-full font-bold shadow-[0_0_30px_rgba(6,182,212,0.3)] text-white text-lg tracking-wide transition-all duration-300 active:scale-95 focus:outline-none focus:ring-4 focus:ring-cyan-500/50 flex items-center justify-center gap-3 ${loading ? 'opacity-80 cursor-wait' : 'hover:scale-105 hover:shadow-[0_0_40px_rgba(6,182,212,0.5)] hover:from-cyan-400 hover:to-blue-500'}`}
            >
                {loading ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Job Queued. Compiling AI Podcast... 
                    </>
                ) : (
                    <>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Generate My First Briefing
                    </>
                )}
            </button>

            {error && (
                <p className="text-red-400 text-sm font-medium bg-red-400/10 px-4 py-2 rounded-full border border-red-400/20 shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2">
                    {error}
                </p>
            )}
        </div>
    );
}
