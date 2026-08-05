/**
 * ITTSProvider Strategy Pattern Interface for zero-downtime TTS Provider Fallbacks.
 */
export interface ITTSProvider {
    synthesize(text: string, languageCode: string): Promise<Buffer>;
}

/**
 * Segments a long podcast script into digestible chunks (roughly 3 sentences each)
 * to prevent payload limits and optimize playback pacing. Supports Indic Purna Virama (।).
 */
export function segmentScriptIntoChunks(script: string, maxSentencesPerChunk: number = 3): string[] {
    const sentences = script.match(/[^.!?।]+[.!?।]+(?:\s|$)/g) || [script];
    
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
 * Splits text into safe sub-phrases of <= 150 characters to prevent TTS 400 Bad Request errors.
 */
function splitTextIntoSafeSubChunks(text: string, maxLength: number = 150): string[] {
    if (text.length <= maxLength) return [text];
    
    // Split by commas, semicolons, dashes, Purna Virama, or spaces
    const parts = text.split(/(?<=[,;:\-\।\s])/);
    const subChunks: string[] = [];
    let current = "";

    for (const part of parts) {
        if ((current + part).length > maxLength) {
            if (current.trim()) subChunks.push(current.trim());
            current = part;
        } else {
            current += part;
        }
    }

    if (current.trim()) {
        subChunks.push(current.trim());
    }

    return subChunks.length > 0 ? subChunks : [text.slice(0, maxLength)];
}

/**
 * Native Multi-Lingual Google Translate TTS Strategy Implementation.
 */
export class GoogleTranslateTTSProvider implements ITTSProvider {
    async synthesize(text: string, languageCode: string = 'en'): Promise<Buffer> {
        const subChunks = splitTextIntoSafeSubChunks(text, 150);
        const audioBuffers: Buffer[] = [];
        const lang = languageCode || 'en';

        for (const subChunk of subChunks) {
            if (!subChunk.trim()) continue;

            const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(subChunk.trim())}&tl=${encodeURIComponent(lang)}&client=tw-ob`;
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
                }
            });

            if (!response.ok) {
                throw new Error(`TTS HTTP Request failed with status ${response.status} for lang [${lang}]`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            if (buffer && buffer.length > 0) {
                audioBuffers.push(buffer);
            }
        }

        if (audioBuffers.length === 0) {
            throw new Error("TTS Error: Empty audio buffer generated");
        }

        return Buffer.concat(audioBuffers);
    }
}

/**
 * Resilient Fallback Wrapper Provider.
 */
export class ResilientTTSProvider implements ITTSProvider {
    constructor(private primary: ITTSProvider) {}

    async synthesize(text: string, languageCode: string): Promise<Buffer> {
        try {
            return await this.primary.synthesize(text, languageCode);
        } catch (err: any) {
            console.error("Primary TTS Provider failed, attempting fallback:", err);
            return await this.primary.synthesize(text, 'en');
        }
    }
}

const defaultTTSProvider = new ResilientTTSProvider(new GoogleTranslateTTSProvider());

/**
 * Fires HTTP requests for text sub-phrases to the resilient multi-lingual TTS engine provider,
 * concatenates all MP3 buffers, and returns the final binary MP3 Node Buffer.
 */
export async function generateAudioBufferForChunk(text: string, languageCode: string = 'en'): Promise<Buffer> {
    return defaultTTSProvider.synthesize(text, languageCode);
}
