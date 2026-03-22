import asyncio
from src.config.settings import gemini_client, supabase_client
from src.services.gnews import GNewsIngestionService
from src.services.embedding import SemanticEmbeddingService
from src.services.database import VectorDatabaseService

async def run_audiobook_ingestion_pipeline(topic_query: str):
    print(f"==================================================")
    print(f"Starting ingestion pipeline for topic: '{topic_query}'")
    print(f"==================================================")
    
    if not gemini_client or not supabase_client:
        print("❌ Error: GenAI or Supabase clients are missing. Ensure API keys are in your .env file.")
        return
        
    news_service = GNewsIngestionService()
    embedding_service = SemanticEmbeddingService(client=gemini_client)
    db_service = VectorDatabaseService(supabase_client=supabase_client)
    
    # print("\n[1/3] Fetching real-time news articles (MOCKED)...")
    
    # 2. Asynchronous Data Acquisition
    # Temporarily comment out the live API call to save credits:
    articles = await news_service.fetch_topic_news(topic_query)
    
    # Create mock data to debug your embedding and database insertion logic
    # from src.models.article import NewsArticle
    # articles = [
    #     NewsArticle(
    #         url="https://mock.example.com/1",
    #         title="Witnessing breakthroughs and breakdowns: India Today Chairman Aroon Purie on paradox of modern times",
    #         content="A deeply reflective piece on the technological breakthroughs defining the modern era, contrasting them with the breakdowns in social structures.",
    #         published_at="2023-10-01T12:00:00Z",
    #         source_name="India Today",
    #         source_country="in"
    #     ),
    #     NewsArticle(
    #         url="https://mock.example.com/2",
    #         title="This Week in AI: The Biggest AI News, Breakthroughs, and Power Moves",
    #         content="A roundup of the week's most significant advancements in Artificial Intelligence, including new funding rounds and startup launches.",
    #         published_at="2023-10-02T12:00:00Z",
    #         source_name="AI Weekly",
    #         source_country="benchmark"
    #     ),
    #     NewsArticle(
    #         url="https://mock.example.com/3",
    #         title="Microsoft CEO Satya Nadella may have just agreed with Google DeepMind CEO Demis Hassabis on 'next AI breakthroughs'",
    #         content="Industry leaders from Microsoft and Google DeepMind share a converging vision on what the next generation of AI capabilities will look like, focusing on agency and reasoning.",
    #         published_at="2023-10-03T12:00:00Z",
    #         source_name="Tech Insider",
    #         source_country="us"
    #     )
    # ]
    
    if not articles:
        print("❌ No articles fetched or API error occurred.")
        return
        
    print(f"✅ Retrieved {len(articles)} articles. Processing...")
    
    print("\n[2/3 & 3/3] Generating vectors and persisting to database...")
    success_count = 0
    
    for i, article in enumerate(articles, 1):
        try:
            rich_text_payload = f"Title: {article.title}\nSource: {article.source_name}\n\nContent:\n{article.content}"
            vector = embedding_service.generate_vector(rich_text_payload)
            
            if not vector:
                print(f"   [{i}/{len(articles)}] ❌ Embedding generation failed for: '{article.title}'")
                continue
                
            success = db_service.persist_article(article, vector)
            
            if success:
                print(f"   [{i}/{len(articles)}] ✅ Successfully ingested: '{article.title}'")
                success_count += 1
            else:
                print(f"   [{i}/{len(articles)}] ❌ Database persistence failed for: '{article.title}'")
                
        except Exception as e:
            print(f"   [{i}/{len(articles)}] ❌ Unexpected error processing '{article.title}': {e}")
            
    print(f"\n==================================================")
    print(f"Pipeline complete! Successfully ingested {success_count} out of {len(articles)} articles.")
    print(f"==================================================")
