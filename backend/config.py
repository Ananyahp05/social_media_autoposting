import os
from dotenv import load_dotenv

load_dotenv()

# LinkedIn
CLIENT_ID = os.getenv("LINKEDIN_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET", "")
REDIRECT_URI = os.getenv("REDIRECT_URI", "http://localhost:8000/linkedin/callback")
TWITTER_CALLBACK_URL = os.getenv("TWITTER_CALLBACK_URL", "http://localhost:8000/twitter/callback")

# Gemini AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# Twitter/X
TWITTER_API_KEY = os.getenv("TWITTER_API_KEY", "")
TWITTER_API_SECRET = os.getenv("TWITTER_API_SECRET", "")

# Instagram (via Facebook/Meta)
INSTAGRAM_APP_ID = os.getenv("INSTAGRAM_APP_ID", "")
INSTAGRAM_APP_SECRET = os.getenv("INSTAGRAM_APP_SECRET", "")
INSTAGRAM_REDIRECT_URI = os.getenv("INSTAGRAM_REDIRECT_URI", "http://localhost:8000/instagram/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
INSTAGRAM_USER_ID = os.getenv("INSTAGRAM_USER_ID", "")
INSTAGRAM_PAGE_ID = os.getenv("INSTAGRAM_PAGE_ID", "")