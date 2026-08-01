import { supabaseServer } from '@/lib/supabase';

/**
 * Uploads a raw MP3 Buffer to the Supabase storage bucket systematically.
 * Organizes files by language code (e.g. user_id/session_id/hi/chunk_1.mp3).
 * Returns the public URL for the frontend audio player.
 */
export async function uploadAudioChunk(
    buffer: Buffer, 
    userId: string, 
    sessionId: string, 
    chunkIndex: number,
    languageCode: string = 'en'
): Promise<string> {
    const bucket = 'audio_chunks';
    const lang = languageCode || 'en';
    
    // Systematic path: user_id/session_id/lang/chunk_1.mp3
    const filePath = `${userId}/${sessionId}/${lang}/chunk_${chunkIndex}.mp3`;

    // Upsert explicitly to true so we can rapidly regenerate sessions without file locking collisions
    const { data, error } = await supabaseServer.storage
        .from(bucket)
        .upload(filePath, buffer, {
            contentType: 'audio/mpeg',
            upsert: true
        });

    if (error) {
        throw new Error(`Supabase audio upload failed for chunk ${chunkIndex} (${lang}): ${error.message}`);
    }

    // Retrieve the public URL string so the frontend player can mount it immediately
    const { data: publicUrlData } = supabaseServer.storage
        .from(bucket)
        .getPublicUrl(filePath);
        
    return publicUrlData.publicUrl;
}
