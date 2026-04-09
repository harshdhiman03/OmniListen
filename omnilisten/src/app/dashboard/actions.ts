"use server";

import { supabaseServer } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

/**
 * Next.js 14 Server Action. 
 * Securely fires a message into the Supabase pgmq queue to asynchronously generate an audiobook.
 * Returns instantly to the client, entirely overriding the Vercel limits!
 */
export async function generateOnDemandBriefing(userId: string) {
    try {
        console.log(`[Server Action] Enqueueing audio generation job for user ${userId}...`);
        
        // Push message to the 'audio_jobs' queue utilizing our custom PostgreSQL wrapper function
        // because the native pgmq schema is purposefully hidden from the exposed PostgREST API!
        const { error: mqError } = await supabaseServer.rpc('enqueue_audio_job', { p_user_id: userId });

        if (mqError) throw new Error(`Queue rejection: ${mqError.message}`);

        revalidatePath('/dashboard');
        
        return { success: true, status: "Job added to queue" };
    } catch (error: any) {
        console.error("Dashboard Server Action failed:", error);
        return { success: false, error: error.message };
    }
}
