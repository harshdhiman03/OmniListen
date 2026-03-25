import textToSpeech from '@google-cloud/text-to-speech';

// Initialize the client with explicit credentials
const client = new textToSpeech.TextToSpeechClient({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    // Vercel and .env files often escape the newline characters. 
    // The .replace() function is crucial to format the RSA key correctly.
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }
});

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
 * Fires a request to the Google Cloud Text-to-Speech API for a given chunk of text.
 * Returns the raw binary MP3 Node Buffer.
 */
export async function generateAudioBufferForChunk(text: string): Promise<Buffer> {
    const request = {
        input: { text },
        // En-US-Journey voices are generally phenomenal for podcast pacing.
        voice: { languageCode: 'en-US', name: 'en-US-Journey-F' }, 
        // as const is needed for typescript to recognize the specific enum value
        audioConfig: { audioEncoding: 'MP3' as const }
    };

    const [response] = await client.synthesizeSpeech(request);

    if (!response.audioContent) {
        throw new Error("Google TTS API Error: No audio content was returned");
    }

    // audioContent is a Uint8Array or Buffer naturally in this SDK
    return Buffer.from(response.audioContent);
}
