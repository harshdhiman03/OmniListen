import os
import logging
from dotenv import load_dotenv

from google import genai
from supabase import create_client, Client

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class Settings:
    # Google GenAI setup
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
    
    # Supabase setup
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
    
    # GNews setup
    GNEWS_API_KEY = os.environ.get("GNEWS_API_KEY", "")

def get_gemini_client():
    try:
        return genai.Client(api_key=Settings.GEMINI_API_KEY) if Settings.GEMINI_API_KEY else None
    except Exception as e:
        logger.error(f"Failed to initialize GenAI Client: {e}")
        return None

def get_supabase_client() -> Client:
    try:
        return create_client(Settings.SUPABASE_URL, Settings.SUPABASE_SERVICE_KEY)
    except Exception as e:
        logger.error(f"Failed to initialize Supabase Client: {e}")
        return None

# Export initialized singletons for use across the application
gemini_client = get_gemini_client()
supabase_client = get_supabase_client()
