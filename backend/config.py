import os
from dotenv import load_dotenv

load_dotenv()

# LinkedIn
CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET", "")
REDIRECT_URI = os.getenv("REDIRECT_URI", "")
TWITTER_CALLBACK_URL = os.getenv("TWITTER_CALLBACK_URL", "")

# Gemini AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Twitter/X
TWITTER_API_KEY = os.getenv("TWITTER_API_KEY", "")
TWITTER_API_SECRET = os.getenv("TWITTER_API_SECRET", "")