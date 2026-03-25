import { NextResponse } from 'next/server';
import { 
    getUserInterestVector, 
    getRelevantArticles, 
    generatePodcastScript 
} from '@/services/scriptwriter.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { user_id } = body;

        // 1. Validate Input
        if (!user_id) {
            return NextResponse.json(
                { error: 'Missing user_id in request body' }, 
                { status: 400 }
            );
        }

        // 2. Fetch User Profile Data
        const interestVector = await getUserInterestVector(user_id);

        // 3. Retrieve Personalized Articles
        const articles = await getRelevantArticles(interestVector);

        // 4. Generate AI Podcast Script
        const scriptResponse = await generatePodcastScript(articles);

        // 5. Send Response
        return NextResponse.json({ script: scriptResponse });

    } catch (error: any) {
        console.error("Script generation route error:", error);
        const statusCode = error.status || 500;
        
        return NextResponse.json(
            { error: error.message || "Internal Server Error" }, 
            { status: statusCode }
        );
    }
}
