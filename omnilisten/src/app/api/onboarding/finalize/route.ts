import { NextResponse } from 'next/server';
import { genAI } from '@/lib/gemini';
import { supabaseServer } from '@/lib/supabase';

// Inject Groq into the route explicitly
import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { user_id, history } = body;

        // 1. Sanitize Incoming Context
        if (!history || !Array.isArray(history)) {
            return NextResponse.json({ error: 'Missing chat history' }, { status: 400 });
        }

        // 2. Synthesize History into an Analytical Block natively via LLaMA (bypassing Google's rate limits)
        const conversationText = history.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
        
        const systemInstruction = "You are an analytical AI data extractor. Read the attached onboarding conversation and summarize the user's core interests into a single, highly dense paragraph. Do not include introductory filler, just the dense summary of all discovered topics, industries, and hobbies.";

        const chatCompletion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemInstruction },
                { role: 'user', content: conversationText }
            ],
            model: 'llama-3.1-8b-instant',
        });

        const summaryParagraph = chatCompletion.choices[0]?.message?.content || "General interests and world news";

        // 3. Transform Summary into a Semantic Vector
        // Falling back to the currently supported gemini-embedding-001 model for Node.js
        const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        
        const embedResult = await embeddingModel.embedContent({
            content: {
                role: "user",
                parts: [{ text: summaryParagraph }]
            },
            outputDimensionality: 768
        } as any);
        
        const embeddingVector = embedResult.embedding.values;

        if (!embeddingVector || embeddingVector.length === 0) {
            throw new Error("Google GenAI failed to return an embedding vector");
        }

        // 4. Secure JWT verification mapping
        const { createClient } = await import('@/utils/supabase/server');
        const supabaseSession = await createClient();
        const { data: { user } } = await supabaseSession.auth.getUser();

        if (user) {
            // Using Service Role specifically for vector insertion as it requires elevated permissions
            // but we STRICTLY enforce it applies only to the verified JWT session Identity.
            const { error: dbError } = await supabaseServer
                .from('profiles')
                .upsert({ id: user.id, first_name: "Agent Listener", interest_vector: embeddingVector });

            if (dbError) {
                console.error("Supabase Database Update Failed:", dbError);
                throw new Error(`Failed to commit vector to Profile: ${dbError.message}`);
            }
        } else {
            return NextResponse.json({ error: 'Unauthorized Session' }, { status: 401 });
        }

        // 5. Final OK to FrontEnd
        return NextResponse.json({ 
            success: true, 
            summary: summaryParagraph 
        });

    } catch (error: any) {
        console.error("Finalize Onboarding API error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" }, 
            { status: 500 }
        );
    }
}
