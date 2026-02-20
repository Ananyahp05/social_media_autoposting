from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from urllib.parse import quote
from typing import Optional
from requests_oauthlib import OAuth1Session
import requests
import os
import json

from db import get_db
from models import TwitterUser
from config import TWITTER_API_KEY, TWITTER_API_SECRET

router = APIRouter(prefix="/twitter", tags=["Twitter"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
TWITTER_CALLBACK_URL = os.getenv("TWITTER_CALLBACK_URL", "")

# Temporary storage for OAuth request tokens (in production, use Redis/session)
_oauth_tokens = {}


# 🔹 Step 1: Get request token and redirect to Twitter auth
@router.get("/login")
def login():
    try:
        oauth = OAuth1Session(
            TWITTER_API_KEY,
            client_secret=TWITTER_API_SECRET,
            callback_uri=TWITTER_CALLBACK_URL,
        )
        url = "https://api.twitter.com/oauth/request_token"
        response = oauth.fetch_request_token(url)

        oauth_token = response.get("oauth_token")
        oauth_token_secret = response.get("oauth_token_secret")

        # Store the secret for the callback
        _oauth_tokens[oauth_token] = oauth_token_secret

        auth_url = f"https://api.twitter.com/oauth/authorize?oauth_token={oauth_token}"
        print(f"[DEBUG] Twitter auth URL: {auth_url}")
        return {"auth_url": auth_url}

    except Exception as e:
        print(f"[ERROR] Twitter login: {e}")
        raise HTTPException(status_code=500, detail=f"Twitter login failed: {str(e)}")


# 🔹 Step 2: Callback — Twitter redirects here after authorization
@router.get("/callback")
def callback(oauth_token: str, oauth_verifier: str, db: Session = Depends(get_db)):
    try:
        oauth_token_secret = _oauth_tokens.pop(oauth_token, None)
        if not oauth_token_secret:
            return RedirectResponse(f"{FRONTEND_URL}?twitter=error&message={quote('Invalid OAuth session. Please try again.')}")

        oauth = OAuth1Session(
            TWITTER_API_KEY,
            client_secret=TWITTER_API_SECRET,
            resource_owner_key=oauth_token,
            resource_owner_secret=oauth_token_secret,
            verifier=oauth_verifier,
        )

        url = "https://api.twitter.com/oauth/access_token"
        tokens = oauth.fetch_access_token(url)

        access_token = tokens["oauth_token"]
        access_token_secret = tokens["oauth_token_secret"]
        twitter_user_id = tokens["user_id"]
        screen_name = tokens.get("screen_name", "")

        print(f"[DEBUG] Twitter connected: @{screen_name} (ID: {twitter_user_id})")

        # Save or update in DB
        existing = db.query(TwitterUser).filter(TwitterUser.twitter_id == twitter_user_id).first()
        if existing:
            existing.access_token = access_token
            existing.access_token_secret = access_token_secret
            existing.screen_name = screen_name
        else:
            user = TwitterUser(
                twitter_id=twitter_user_id,
                access_token=access_token,
                access_token_secret=access_token_secret,
                screen_name=screen_name,
            )
            db.add(user)
        db.commit()

        return RedirectResponse(f"{FRONTEND_URL}?twitter=success")

    except Exception as e:
        print(f"[ERROR] Twitter callback: {e}")
        return RedirectResponse(f"{FRONTEND_URL}?twitter=error&message={quote(str(e))}")


# 🔹 Check connection status
@router.get("/status")
def status(db: Session = Depends(get_db)):
    user = db.query(TwitterUser).first()
    if user:
        return {"connected": True, "screen_name": user.screen_name}
    return {"connected": False}


# 🔹 Disconnect
@router.delete("/disconnect")
def disconnect(db: Session = Depends(get_db)):
    user = db.query(TwitterUser).first()
    if not user:
        raise HTTPException(status_code=404, detail="No Twitter account connected.")
    db.delete(user)
    db.commit()
    return {"message": "Twitter account disconnected."}


# 🔹 Upload image to Twitter (v1.1 media/upload)
def upload_media(oauth_session, image_bytes: bytes) -> str:
    """Upload image to Twitter and return media_id_string."""
    url = "https://upload.twitter.com/1.1/media/upload.json"
    files = {"media_data": [None, __import__("base64").b64encode(image_bytes).decode("utf-8")]}

    # Use multipart upload
    response = oauth_session.post(
        url,
        data={"media_data": __import__("base64").b64encode(image_bytes).decode("utf-8")},
    )

    print(f"[DEBUG] Media upload: {response.status_code}")
    if response.status_code != 200:
        error_detail = response.text
        if "does not have any credits" in error_detail or response.status_code == 403:
            raise HTTPException(
                status_code=403, 
                detail="Twitter Free Tier does not support image uploads. Please post text only or upgrade to Basic tier."
            )
        raise HTTPException(status_code=400, detail=f"Media upload failed: {error_detail}")

    data = response.json()
    media_id = data["media_id_string"]
    print(f"[DEBUG] Media ID: {media_id}")
    return media_id


# 🔹 Post to Twitter (text + optional image)
@router.post("/post")
async def post(
    text: str = Form(...),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    user = db.query(TwitterUser).first()
    if not user:
        raise HTTPException(status_code=404, detail="No Twitter account connected. Please connect first.")

    oauth = OAuth1Session(
        TWITTER_API_KEY,
        client_secret=TWITTER_API_SECRET,
        resource_owner_key=user.access_token,
        resource_owner_secret=user.access_token_secret,
    )

    # Build tweet payload
    tweet_payload = {"text": text}

    # Upload image if provided
    if image and image.filename:
        image_bytes = await image.read()
        media_id = upload_media(oauth, image_bytes)
        tweet_payload["media"] = {"media_ids": [media_id]}

    # Post tweet via v2 API
    url = "https://api.twitter.com/2/tweets"
    response = oauth.post(url, json=tweet_payload)

    print(f"[DEBUG] Tweet response: {response.status_code} - {response.text}")

    if response.status_code not in [200, 201]:
        error_data = response.json()
        error_msg = error_data.get("detail", error_data.get("title", response.text))
        raise HTTPException(status_code=400, detail=f"Tweet failed: {error_msg}")

    return {"message": "Posted to Twitter/X successfully!"}
