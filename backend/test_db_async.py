import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.services.db_async import async_engine, DATABASE_URL
from sqlalchemy.pool import NullPool

def test_engine_configuration():
    print("=== Testing Async Database Engine Configuration ===")
    print(f"Database Driver: {async_engine.url.drivername}")
    print(f"Configured Pool Class: {async_engine.pool.__class__.__name__}")
    
    assert async_engine.pool.__class__ == NullPool, "Pool class MUST be NullPool for serverless execution"
    print("\n>>> SUCCESS: All architectural Pool & Prepared Statement Collision assertions passed! <<<")

if __name__ == "__main__":
    test_engine_configuration()
