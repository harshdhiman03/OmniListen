import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const execFileAsync = promisify(execFile);

/**
 * Segments a long podcast script into digestible chunks (roughly 3 sentences each)
 * to prevent TTS API timeouts and stay within payload limits.
 */
export function segmentScriptIntoChunks(script: string, maxSentencesPerChunk: number = 3): string[] {
    // Splits reliably by periods, exclamation marks, or question marks followed by spaces.
    const sentences = script.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [script];
    
    const chunks: string[] = [];
    let currentChunk = "";
    let sentenceCount = 0;

    for (const sentence of sentences) {
        currentChunk += sentence;
        sentenceCount++;
        if (sentenceCount >= maxSentencesPerChunk) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
            sentenceCount = 0;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * Fires a request to Microsoft Edge TTS for a given chunk of text using high-quality neural voice (en-US-AvaNeural).
 * Returns the raw binary MP3 Node Buffer.
 */
export async function generateAudioBufferForChunk(text: string): Promise<Buffer> {
    const tempAudioPath = join(tmpdir(), `omnilisten_tts_${randomUUID()}.mp3`);
    
    try {
        await execFileAsync('python', [
            '-m', 'edge_tts',
            '--voice', 'en-US-AvaNeural',
            '--text', text,
            '--write-media', tempAudioPath
        ]);

        const audioBuffer = await readFile(tempAudioPath);
        
        if (!audioBuffer || audioBuffer.length === 0) {
            throw new Error("Edge TTS Error: Generated audio file is empty");
        }

        return audioBuffer;

    } catch (err: any) {
        console.error("Edge TTS Synthesis Failed:", err);
        throw new Error(`Edge TTS Generation Error: ${err?.message || err}`);
    } finally {
        try {
            await unlink(tempAudioPath);
        } catch {
            // Ignore cleanup error if temp file was never created
        }
    }
}
