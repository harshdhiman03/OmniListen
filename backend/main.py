import os
from dotenv import load_dotenv
import google.generativeai as genai
from supabase import create_client, Client

# Load environment variables from .env file
load_dotenv()

# Initialize Google GenAI client
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# Initialize Supabase Python client
# REMINDER: The SUPABASE_URL must point to the dedicated pooler port 6543 and use IPv6 or the IPv4 add-on to ensure proper connection pooling.
supabase_url: str = os.environ.get("SUPABASE_URL", "")
supabase_key: str = os.environ.get("SUPABASE_SERVICE_KEY", "")

supabase: Client = create_client(supabase_url, supabase_key)

if __name__ == "__main__":
    print("Backend initialized successfully.")
