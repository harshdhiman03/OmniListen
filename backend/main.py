import sys
import asyncio
from src.pipelines.ingestion import run_audiobook_ingestion_pipeline

if __name__ == "__main__":
    # Execute the primary pipeline script dynamically from the terminal 
    topic = sys.argv[1] if len(sys.argv) > 1 else "technology"
    asyncio.run(run_audiobook_ingestion_pipeline(topic))
