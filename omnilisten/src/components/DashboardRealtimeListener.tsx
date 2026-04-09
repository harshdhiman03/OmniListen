"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardRealtimeListener({ userId, isGenerating }: { userId: string, isGenerating: boolean }) {
    const router = useRouter();

    useEffect(() => {
        // We only poll while explicitly marked as actively generating by the client component 
        // to save vast amounts of network traffic and database overhead!
        if (!isGenerating) return;

        console.log("[Listener] Background generation detected. Polling exactly every 3 seconds...");

        const interval = setInterval(async () => {
            try {
                // A lightweight check directly against the Next.js backend
                const response = await fetch(`/api/check-playlist?userId=${userId}`, { cache: 'no-store' });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    // The nanosecond the background worker drops the row into the database, it triggers!
                    if (data.exists) {
                        console.log("[Listener] Background async compilation complete! Snapping AudioPlayer into view...");
                        clearInterval(interval);
                        
                        // Tells Next.js to obliterate the client cache and refetch the Dashboard Server Component!
                        router.refresh(); 
                    }
                }
            } catch (err) {
                console.error("Polling error:", err);
            }
        }, 3000);

        // Cleanup interval automatically when the component unmounts or state changes
        return () => clearInterval(interval);

    }, [isGenerating, userId, router]);

    return null; // Invisible strictly utility component
}
