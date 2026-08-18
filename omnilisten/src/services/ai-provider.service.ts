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
 * Open-Source Flexible & Resilient Dual AI Provider Service.
 * Automatically handles text generation across Google Gemini and Groq API
 * with configurable model strings and automatic zero-downtime fallbacks.
 */
export async function generateTextContent(options: IGenerateTextOptions): Promise<string> {
    const { prompt, systemInstruction } = options;

    const tryGemini = async (): Promise<string | null> => {
        try {
            const geminiModel = genAI.getGenerativeModel({
                model: DEFAULT_GEMINI_MODEL,
                systemInstruction: systemInstruction || undefined
            });
            const res = await geminiModel.generateContent(prompt);
            const text = res.response.text();
            if (text && text.trim().length > 0) {
                return text.trim();
            }
            return null;
        } catch (err: any) {
            console.warn(`[AI Provider Warning] Gemini (${DEFAULT_GEMINI_MODEL}) generation error:`, err.message || err);
            return null;
        }
    };

    const tryGroq = async (): Promise<string | null> => {
        if (!groq) {
            console.warn("[AI Provider Warning] Groq API key not configured.");
            return null;
        }
        try {
            const messages: any[] = [];
            if (systemInstruction) {
                messages.push({ role: 'system', content: systemInstruction });
            }
            messages.push({ role: 'user', content: prompt });

            const completion = await groq.chat.completions.create({
                messages,
                model: DEFAULT_GROQ_MODEL,
            });
            const text = completion.choices[0]?.message?.content;
            if (text && text.trim().length > 0) {
                return text.trim();
            }
            return null;
        } catch (err: any) {
            console.warn(`[AI Provider Warning] Groq (${DEFAULT_GROQ_MODEL}) generation error:`, err.message || err);
            return null;
        }
    };

    // Provider Execution Strategy
    if (PREFERRED_PROVIDER === 'groq') {
        const groqResult = await tryGroq();
        if (groqResult) return groqResult;
        console.log("[AI Provider Fallback] Falling back to Gemini...");
        const geminiResult = await tryGemini();
        if (geminiResult) return geminiResult;
    } else {
        // Default 'auto' or 'gemini'
        const geminiResult = await tryGemini();
        if (geminiResult) return geminiResult;
        console.log("[AI Provider Fallback] Falling back to Groq...");
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
