import { genAI } from '@/lib/gemini';
import Groq from 'groq-sdk';

const groqApiKey = process.env.GROQ_API_KEY || '';
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash';
const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL_NAME || 'llama-3.3-70b-versatile';
const PREFERRED_PROVIDER = process.env.LLM_PROVIDER || 'auto'; // 'auto' | 'gemini' | 'groq'

export interface IGenerateTextOptions {
    prompt: string;
    systemInstruction?: string;
    temperature?: number;
}

/**
 * Open-Source Resilient Multi-Tier Dual AI Provider Service.
 * Features an exponential backoff retry engine for Google Gemini (recovering from 503 high demand spikes)
 * and multi-model fallback cascades for Groq API (recovering from 404/400 model deprecations).
 */
export async function generateTextContent(options: IGenerateTextOptions): Promise<string> {
    const { prompt, systemInstruction } = options;

    const tryGemini = async (): Promise<string | null> => {
        const geminiModelsToTry = Array.from(new Set([
            DEFAULT_GEMINI_MODEL,
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-flash-latest'
        ]));

        for (const modelName of geminiModelsToTry) {
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    const geminiModel = genAI.getGenerativeModel({
                        model: modelName,
                        systemInstruction: systemInstruction || undefined
                    });
                    const res = await geminiModel.generateContent(prompt);
                    const text = res.response.text();
                    if (text && text.trim().length > 0) {
                        return text.trim();
                    }
                } catch (err: any) {
                    console.warn(`[AI Provider Warning] Gemini (${modelName}, attempt ${attempt}/3) error:`, err.message || err);
                    // Exponential backoff delay for 503 high demand spikes or 429 rate limits
                    if (attempt < 3 && (err.message?.includes('503') || err.status === 503 || err.status === 429)) {
                        await new Promise(r => setTimeout(r, 1000 * attempt));
                    } else {
                        break; // try next model if non-retriable or max retries reached
                    }
                }
            }
        }
        return null;
    };

    const tryGroq = async (): Promise<string | null> => {
        if (!groq) {
            console.warn("[AI Provider Warning] Groq API key not configured.");
            return null;
        }

        const groqModelsToTry = Array.from(new Set([
            DEFAULT_GROQ_MODEL,
            'llama-3.3-70b-versatile',
            'openai/gpt-oss-120b',
            'openai/gpt-oss-20b',
            'qwen/qwen3.6-27b',
            'groq/compound',
            'groq/compound-mini',
            'allam-2-7b'
        ]));

        for (const modelName of groqModelsToTry) {
            try {
                const messages: any[] = [];
                if (systemInstruction) {
                    messages.push({ role: 'system', content: systemInstruction });
                }
                messages.push({ role: 'user', content: prompt });

                const completion = await groq.chat.completions.create({
                    messages,
                    model: modelName,
                });
                const text = completion.choices[0]?.message?.content;
                if (text && text.trim().length > 0) {
                    return text.trim();
                }
            } catch (err: any) {
                console.warn(`[AI Provider Warning] Groq (${modelName}) error:`, err.message || err);
            }
        }
        return null;
    };

    // Provider Execution Strategy
    if (PREFERRED_PROVIDER === 'groq') {
        const groqResult = await tryGroq();
        if (groqResult) return groqResult;
        console.log("[AI Provider Fallback] Groq failed. Falling back to Gemini multi-tier retry engine...");
        const geminiResult = await tryGemini();
        if (geminiResult) return geminiResult;
    } else {
        // Default 'auto' or 'gemini'
        const geminiResult = await tryGemini();
        if (geminiResult) return geminiResult;
        console.log("[AI Provider Fallback] Gemini failed/busy. Falling back to Groq multi-tier cascade...");
        const groqResult = await tryGroq();
        if (groqResult) return groqResult;
    }

    throw new Error("All AI text generation providers (Gemini & Groq) failed or returned empty content.");
}

/**
 * Generates a 768-dimensional semantic embedding vector using Gemini gemini-embedding-001.
 */
export async function generateVectorEmbedding(text: string): Promise<number[]> {
    try {
        const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        const embedResult = await embeddingModel.embedContent({
            content: {
                role: "user",
                parts: [{ text }]
            },
            outputDimensionality: 768
        } as any);

        if (embedResult.embedding?.values) {
            return embedResult.embedding.values;
        }
        throw new Error("Gemini returned empty embedding values");
    } catch (err: any) {
        console.error("[AI Provider Error] Vector embedding generation failed:", err.message || err);
        throw err;
    }
}
