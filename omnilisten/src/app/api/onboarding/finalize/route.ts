import { NextResponse } from 'next/server';
import { genAI } from '@/lib/gemini';
import { supabaseServer } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { user_id, history } = body;

        // 1. Sanitize Incoming Context
        if (!history || !Array.isArray(history)) {
            return NextResponse.json({ error: 'Missing chat history' }, { status: 400 });
        }

        // 2. Synthesize History into an Analytical Block
        const conversationText = history.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
        
        const summaryModel = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: "You are an analytical AI data extractor. Read the attached onboarding conversation and summarize the user's core interests into a single, highly dense paragraph. Do not include introductory filler, just the dense summary of all discovered topics, industries, and hobbies."
        });

        const summaryResult = await summaryModel.generateContent(conversationText);
        const summaryParagraph = summaryResult.response.text();

        // 3. Transform Summary into a Semantic Vector
        // Falling back to the currently supported gemini-embedding-001 model for Node.js
        const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
        
        // Pass the raw string directly! The SDK natively wraps this into the correct { parts: [] } schema securely.
        const embedResult = await embeddingModel.embedContent(summaryParagraph);
        
        const embeddingVector = embedResult.embedding.values;

        if (!embeddingVector || embeddingVector.length === 0) {
            throw new Error("Google GenAI failed to return an embedding vector");
        }

        // 4. Upsert Profile Vector to Postgres using Service Role
        if (user_id) {
            const { error: dbError } = await supabaseServer
                .from('profiles')
                .update({ interest_vector: embeddingVector })
                .eq('id', user_id);

            if (dbError) {
                console.error("Supabase Database Update Failed:", dbError);
                throw new Error(`Failed to commit vector to Profile: ${dbError.message}`);
            }
        } else {
            console.warn("No user_id provided. Evaluated vector without saving to Supabase.");
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
