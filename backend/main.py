import asyncio
from src.pipelines.ingestion import run_audiobook_ingestion_pipeline

if __name__ == "__main__":
    # Execute the primary pipeline script
    asyncio.run(run_audiobook_ingestion_pipeline("technology"))
