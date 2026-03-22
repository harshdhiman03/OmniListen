import aiohttp
import logging
from typing import List

from src.models.article import NewsArticle
from src.config.settings import Settings

logger = logging.getLogger(__name__)

class GNewsIngestionService:
    def __init__(self):
        self.api_key = Settings.GNEWS_API_KEY
        self.base_url = "https://gnews.io/api/v4/search"

    async def fetch_topic_news(self, query: str) -> List[NewsArticle]:
        if not self.api_key:
            logger.error("GNews API key is not set.")
            return []

        params = {
            "q": query,
            "lang": "en",
            "max": "10",
            "sortby": "relevance",
            "apikey": self.api_key
        }
        
        articles = []
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(self.base_url, params=params) as response:
                    if response.status in (401, 403, 429):
                        logger.error(f"GNews API returned error status: {response.status}")
                        return []
                    
                    response.raise_for_status()
                    data = await response.json()
                    
                    for item in data.get("articles", []):
                        description = item.get("description") or ""
                        content_body = item.get("content") or ""
                        
                        full_content = f"{description}\n\n{content_body}".strip()
                        source = item.get("source", {})
                        
                        article = NewsArticle(
                            url=item.get("url", ""),
                            title=item.get("title", ""),
                            content=full_content,
                            published_at=item.get("publishedAt", ""),
                            source_name=source.get("name", ""),
                            source_country=source.get("country", "")
                        )
                        articles.append(article)
                        
            except aiohttp.ClientError as e:
                logger.error(f"HTTP request to GNews failed: {e}")
                return []
                
        return articles
