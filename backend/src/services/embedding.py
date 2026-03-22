import logging
from google.genai import types

logger = logging.getLogger(__name__)

class SemanticEmbeddingService:
    def __init__(self, client):
        self.client = client
        self.model = "gemini-embedding-001" 

    def generate_vector(self, text: str) -> list[float]:
        try:
            config = types.EmbedContentConfig(
                output_dimensionality=768,
                task_type="RETRIEVAL_DOCUMENT"
            )
            
            result = self.client.models.embed_content(
                model=self.model,
                contents=text,
                config=config
            )
            
            if hasattr(result, "embeddings") and isinstance(result.embeddings, list) and len(result.embeddings) > 0:
                values = result.embeddings[0].values
                return list(values)
            elif hasattr(result, "embeddings") and hasattr(result.embeddings, "values"):
                return list(result.embeddings.values)
            
            return []
            
        except TimeoutError as e:
            logger.error(f"Timeout while generating text embedding: {e}")
            return []
        except Exception as e:
            logger.error(f"Failed to generate vector embedding: {e}")
            return []
