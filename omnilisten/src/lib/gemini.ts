import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';

if (!apiKey) {
    console.warn("Gemini API key missing from Next.js environment variables.");
}

// Initialize the Gemini client strictly for server-side usage
export const genAI = new GoogleGenerativeAI(apiKey);

export const SCRIPTWRITER_SYSTEM_PROMPT = 
    "You are an on-demand spoken word podcaster. Rewrite these news articles into a single, cohesive " +
    "3-minute podcast script. Use a conversational tone, short sentences, and natural transitions " +
    "between stories. Avoid bullet points or rigid explanations.";
