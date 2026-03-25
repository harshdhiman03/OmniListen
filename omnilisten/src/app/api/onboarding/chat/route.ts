import { NextResponse } from 'next/server';
import { genAI } from '@/lib/gemini';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { history } = body;

        if (!history || !Array.isArray(history)) {
            return NextResponse.json(
                { error: 'Missing or invalid chat history' }, 
                { status: 400 }
            );
        }

        // Format the UI's history array into the strict role properties Gemini expects
        const formattedHistory = history.map((msg: any) => ({
            role: msg.role === 'ai' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const model = genAI.getGenerativeModel({ 
            // Leveraging the blazing fast 2.5 flash model as requested for snappy conversational UI
            model: "gemini-2.5-flash",
            systemInstruction: "You are an excellent onboarding assistant for a personalized news radio app. Ask EXACTLY ONE short follow-up question to dig deeper into the user's stated interests. Keep it very friendly and concise."
        });

        // Split off the most recent user message from the historical context
        const previousHistory = formattedHistory.slice(0, -1);
        const lastMessage = formattedHistory[formattedHistory.length - 1].parts[0].text;

        // Initialize the Gemini conversation state naturally
        const chatSession = model.startChat({
            history: previousHistory,
        });

        // Stream the message to the model
        const result = await chatSession.sendMessage(lastMessage);
        
        // Return exactly what the UI component 'ChatOnboarding' expects
        return NextResponse.json({ reply: result.response.text() });

    } catch (error: any) {
        console.error("Chat Onboarding API error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" }, 
            { status: 500 }
        );
    }
}
