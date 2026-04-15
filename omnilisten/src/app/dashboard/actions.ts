"use server";

import { createClient } from '@/utils/supabase/server';
import { supabaseServer } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

/**
 * Next.js 14 Server Action. 
 * Securely fires a message into the Supabase pgmq queue to asynchronously generate an audiobook.
 * Native Edge JWT extraction guarantees job queuing is completely immune to ID spoofing!
 */
export async function generateOnDemandBriefing(_clientSideId?: string) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            throw new Error("Unauthorized JWT Session");
        }
        
        const userId = user.id;

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
