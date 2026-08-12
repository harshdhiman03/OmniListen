export interface RawArticlePayload {
    title: string;
    content: string;
    url: string;
    source_domain: string;
    published_at: string;
}


export async function fetchTopHackerNewsArticles(limit: number = 25): Promise<RawArticlePayload[]> {
    try {
        console.log(`[Hacker News Ingestion 📰] Fetching top ${limit} story IDs from Firebase API...`);
        const topStoriesRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
            headers: { 'Accept': 'application/json' },
            cache: 'no-store'
        });

        if (!topStoriesRes.ok) {
            console.error(`Failed to fetch HN top stories: HTTP ${topStoriesRes.status}`);
            return [];
        }

        const storyIds: number[] = await topStoriesRes.json();
        const targetIds = storyIds.slice(0, limit);

        // Fetch story details in parallel using Promise.allSettled
        const storyPromises = targetIds.map(async (id) => {
            try {
                const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
                    headers: { 'Accept': 'application/json' },
                    cache: 'no-store'
                });
                if (!itemRes.ok) return null;
                return await itemRes.json();
            } catch (err) {
                console.warn(`Failed to fetch HN item ${id}:`, err);
                return null;
            }
        });

        const settledResults = await Promise.allSettled(storyPromises);
        const articles: RawArticlePayload[] = [];

        settledResults.forEach(result => {
            if (result.status === 'fulfilled' && result.value) {
                const item = result.value;
                if (item && item.type === 'story' && item.title) {
                    const articleUrl = item.url || `https://news.ycombinator.com/item?id=${item.id}`;
                    const articleContent = item.text 
                        ? item.text.replace(/<[^>]*>?/gm, '') // Strip HTML tags
                        : `${item.title}. Discussion and community insights on Hacker News (Score: ${item.score || 0}, Comments: ${item.descendants || 0}). Read full story at ${articleUrl}`;
                    
                    const publishedAt = item.time 
                        ? new Date(item.time * 1000).toISOString() 
                        : new Date().toISOString();

                    articles.push({
                        title: item.title,
                        content: articleContent,
                        url: articleUrl,
                        source_domain: 'news.ycombinator.com',
                        published_at: publishedAt
                    });
                }
            }
        });

        console.log(`[Hacker News Ingestion 📰] Parsed ${articles.length} valid story items.`);
        return articles;

    } catch (err) {
        console.error("Error in Hacker News ingestion service:", err);
        return [];
    }
}
