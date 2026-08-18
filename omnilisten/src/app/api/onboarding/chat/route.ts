import { NextResponse } from 'next/server';
import { generateTextContent } from '@/services/ai-provider.service';

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

        let formattedHistory: any[] = history.map((msg: any) => ({
            role: msg.role === 'ai' ? 'assistant' : 'user',
            content: msg.content
        }));

        if (formattedHistory.length > 0 && formattedHistory[0].role === 'assistant') {
            formattedHistory.unshift({
                role: 'user',
                content: "Hello OmniListen! Let's build my personalized news radio profile."
            });
        }
        
        const systemInstruction = "You are an excellent onboarding assistant for a personalized news radio app. Ask EXACTLY ONE short follow-up question to dig deeper into the user's stated interests. Keep it very friendly and concise.";

        const chatPrompt = formattedHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
        const reply = await generateTextContent({
            prompt: chatPrompt,
            systemInstruction
        });

        // Return exactly what the UI component 'ChatOnboarding' expects
        return NextResponse.json({ reply: reply || "Excellent, anything else?" });

    } catch (error: any) {
        console.error("Chat Onboarding API error:", error);
        return NextResponse.json(
            { error: error.message || "Internal Server Error" }, 
            { status: 500 }
        );
    }
}
