import logging
from supabase import Client
from src.models.article import NewsArticle

logger = logging.getLogger(__name__)

class VectorDatabaseService:
    def __init__(self, supabase_client: Client):
        self.supabase = supabase_client

    def persist_article(self, article: NewsArticle, embedding: list[float]) -> bool:
        try:
            payload = {
                "url": article.url,                        # NEW: Add 'url' column (text, unique) to Supabase table
                "title": article.title,
                "content": article.content,
                "published_at": article.published_at,
                "source_domain": article.source_name,      # UPDATED: Maps dataclass 'source_name' -> Supabase 'source_domain'
                "source_country": article.source_country,  # NEW: Add 'source_country' column (text) to Supabase table
                "article_vector": embedding                # UPDATED: Matches Supabase 'article_vector' column
            }
            
            self.supabase.table("articles").upsert(payload).execute()
            return True
            
        except Exception as e:
            logger.error(f"Failed to persist article '{article.title}': {e}")
            return False

    def retrieve_contextual_narrative(self, query_vector: list[float], match_count: int = 5):
        try:
            rpc_params = {
                "query_embedding": query_vector,
                "match_threshold": -2.0,
                "match_count": match_count
            }
            
            response = self.supabase.rpc("match_news_articles", rpc_params).execute()
            return response.data
            
        except Exception as e:
            logger.error(f"Failed to retrieve contextual narrative via RPC: {e}")
            return []
