import os
import logging
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, AsyncEngine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)

# Supavisor / PgBouncer Transaction Pooling connection string (Port 6543)
DEFAULT_DB_URL = "postgresql+asyncpg://postgres:password@localhost:6543/postgres?pgbouncer=true"
DATABASE_URL = os.getenv("DATABASE_POOLED_URL", os.getenv("DATABASE_URL", DEFAULT_DB_URL))

# Ensure protocol prefix uses postgresql+asyncpg for SQLAlchemy async engine
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

"""
CRITICAL INFRASRUCTURAL ARCHITECTURE CONFIGURATION:
--------------------------------------------------
1. NullPool:
   Disables application-side connection pooling. In serverless/ephemeral worker runtimes,
   NullPool prevents container instances from hoarding open idle socket pools across invocations,
   delegating all pooling management to Supavisor / PgBouncer.

2. statement_cache_size = 0 (asyncpg):
   Disables driver-level prepared statement caching. In PgBouncer/Supavisor Transaction Pooling mode,
   pooled backend connections shift between transactions. Driver named prepared statements
   (e.g., __asyncpg_stmt_0__) cause catastrophic collision errors ('prepared statement already exists')
   or silent data corruption if cached across transaction boundaries.

3. prepared_statement_cache_size = 0 (SQLAlchemy):
   Disables SQLAlchemy's internal prepared statement cache for absolute safety.
"""
async_engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "command_timeout": 30,
        "server_settings": {
            "application_name": "omnilisten_async_backend"
        }
    },
    echo=False,
    future=True
)

AsyncSessionFactory = sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_async_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency provider for async database sessions with automatic cleanup.
    """
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Async database session transaction rolled back due to error: {e}")
            raise
        finally:
            await session.close()
