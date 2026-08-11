import { supabaseServer } from '@/lib/supabase';

/**
 * L2 Vector Normalization: Ensures vector magnitudes remain exactly 1.0 for cosine distance math.
 */
function normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
}

/**
 * Senior Architect Telemetry-Driven Vector Recalibration Engine:
 * Dynamically shifts a user's 768-dimensional interest_vector based on their listening telemetry
 * (plays, skips, completion ratios, and listening duration).
 *
 * Formula: V_new = Normalize( 0.85 * V_current + 0.15 * Positives - 0.05 * Negatives )
 */
export async function recalibrateUserInterestVector(userId: string): Promise<{ success: boolean; shiftApplied: boolean }> {
    try {
        // 1. Fetch current profile vector
        const { data: profile, error: profileError } = await supabaseServer
            .from('profiles')
            .select('interest_vector')
            .eq('id', userId)
            .single();

        if (profileError || !profile?.interest_vector) {
            console.warn(`[Recalibration] Profile vector for user ${userId} not found.`);
            return { success: false, shiftApplied: false };
        }

        const currentVector: number[] = profile.interest_vector;
        const dimension = currentVector.length; // 768d

        // 2. Fetch listening interactions over the last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: interactions, error: interactionError } = await supabaseServer
            .from('interactions')
            .select('article_id, action_type, duration_listened_seconds, created_at')
            .eq('user_id', userId)
            .gte('created_at', sevenDaysAgo)
            .not('article_id', 'is', null);

        if (interactionError || !interactions || interactions.length === 0) {
            console.log(`[Recalibration] Insufficient interaction telemetry for user ${userId}. No vector shift needed.`);
            return { success: true, shiftApplied: false };
        }

        // 3. Extract unique article IDs for positive vs negative engagement
        const positiveArticleIds: { id: number; weight: number }[] = [];
        const negativeArticleIds: number[] = [];

        interactions.forEach(inter => {
            const articleId = Number(inter.article_id);
            const duration = inter.duration_listened_seconds || 0;
            const action = inter.action_type;

            if (action === 'complete' || action === 'heart' || duration >= 30) {
                const completionWeight = Math.min(1.0, Math.max(0.3, duration / 180));
                positiveArticleIds.push({ id: articleId, weight: completionWeight });
            } else if (action === 'skip' || (duration < 15 && duration > 0)) {
                negativeArticleIds.push(articleId);
            }
        });

        if (positiveArticleIds.length === 0 && negativeArticleIds.length === 0) {
            return { success: true, shiftApplied: false };
        }

        // 4. Fetch article embeddings from database
        const allTargetIds = [...new Set([...positiveArticleIds.map(p => p.id), ...negativeArticleIds])];
        const { data: articles, error: articlesError } = await supabaseServer
            .from('articles')
            .select('id, article_vector')
            .in('id', allTargetIds)
            .not('article_vector', 'is', null);

        if (articlesError || !articles || articles.length === 0) {
            return { success: true, shiftApplied: false };
        }

        const articleVectorMap = new Map<number, number[]>();
        articles.forEach(a => {
            if (Array.isArray(a.article_vector)) {
                articleVectorMap.set(Number(a.id), a.article_vector);
            }
        });

        // 5. Compute Positive Reinforcement Sum Vector
        const positiveSum = new Array(dimension).fill(0);
        let positiveCount = 0;

        positiveArticleIds.forEach(p => {
            const vec = articleVectorMap.get(p.id);
            if (vec && vec.length === dimension) {
                for (let i = 0; i < dimension; i++) {
                    positiveSum[i] += vec[i] * p.weight;
                }
                positiveCount++;
            }
        });

        // 6. Compute Negative Avoidance Sum Vector
        const negativeSum = new Array(dimension).fill(0);
        let negativeCount = 0;

        negativeArticleIds.forEach(id => {
            const vec = articleVectorMap.get(id);
            if (vec && vec.length === dimension) {
                for (let i = 0; i < dimension; i++) {
                    negativeSum[i] += vec[i];
                }
                negativeCount++;
            }
        });

        // 7. Apply Weighted Vector Moving Average Math
        const alpha = 0.85; // Anchor identity weight
        const beta = positiveCount > 0 ? 0.15 / positiveCount : 0;
        const gamma = negativeCount > 0 ? 0.05 / negativeCount : 0;

        const updatedRawVector = new Array(dimension).fill(0);
        for (let i = 0; i < dimension; i++) {
            updatedRawVector[i] = (alpha * currentVector[i]) + (beta * positiveSum[i]) - (gamma * negativeSum[i]);
        }

        // 8. L2 Normalize the updated vector
        const finalVector = normalizeVector(updatedRawVector);

        // 9. Update user's profile interest_vector in Supabase
        const { error: updateError } = await supabaseServer
            .from('profiles')
            .update({
                interest_vector: finalVector,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (updateError) {
            console.error(`[Recalibration Error] Failed to update profile vector for user ${userId}:`, updateError);
            return { success: false, shiftApplied: false };
        }

        console.log(`[Recalibration Success 🧠] User ${userId} interest vector shifted cleanly! (Positives: ${positiveCount}, Negatives: ${negativeCount})`);
        return { success: true, shiftApplied: true };

    } catch (err: any) {
        console.error("Vector recalibration error:", err);
        return { success: false, shiftApplied: false };
    }
}
