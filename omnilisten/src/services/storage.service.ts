import { supabaseServer } from '@/lib/supabase';

/**
 * Uploads a raw MP3 Buffer to the Supabase storage bucket systematically.
 * Returns the raw public URL to allow the frontend `<audio>` elements to consume it.
 */
export async function uploadAudioChunk(
    buffer: Buffer, 
    userId: string, 
    sessionId: string, 
    chunkIndex: number
): Promise<string> {
    const bucket = 'audio_chunks';
    
    // Systematic naming: user_id/session_id/chunk_1.mp3
    const filePath = `${userId}/${sessionId}/chunk_${chunkIndex}.mp3`;

    // Upsert explicitly to true so we can rapidly regenerate sessions without file locking collisions
    const { data, error } = await supabaseServer.storage
        .from(bucket)
        .upload(filePath, buffer, {
            contentType: 'audio/mpeg',
            upsert: true
        });

    if (error) {
        throw new Error(`Supabase audio upload failed for chunk ${chunkIndex}: ${error.message}`);
    }

    // Retrieve the public URL string so the frontend player can mount it immediately
    const { data: publicUrlData } = supabaseServer.storage
        .from(bucket)
        .getPublicUrl(filePath);
        
    return publicUrlData.publicUrl;
}
