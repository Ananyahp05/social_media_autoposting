from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from urllib.parse import quote
from typing import Optional
import requests
import os

from db import get_db
from models import LinkedInUser
from config import CLIENT_ID, CLIENT_SECRET, REDIRECT_URI

router = APIRouter(prefix="/linkedin", tags=["LinkedIn"])

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


# 🔹 Step 1: Login — redirects user to LinkedIn OAuth
@router.get("/login")
def login():
    encoded_redirect = quote(REDIRECT_URI, safe="")
    url = (
        "https://www.linkedin.com/oauth/v2/authorization"
        f"?response_type=code"
        f"&client_id={CLIENT_ID}"
        f"&redirect_uri={encoded_redirect}"
        "&scope=openid%20profile%20w_member_social"
        "&prompt=login"
    )
    print(f"[DEBUG] OAuth URL: {url}")
    print(f"[DEBUG] REDIRECT_URI: {REDIRECT_URI}")
    return {"auth_url": url}


# 🔹 Step 2: Callback — LinkedIn redirects here after user approves
@router.get("/callback")
def callback(code: str, db: Session = Depends(get_db)):
    try:
        print(f"[DEBUG] Callback received with code: {code[:10]}...")
        # Exchange code for access token
        token_url = "https://www.linkedin.com/oauth/v2/accessToken"
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
        }

        res = requests.post(token_url, data=data)
        token_data = res.json()
        print(f"[DEBUG] Token response: {res.status_code} - {token_data}")

        if "access_token" not in token_data:
            return RedirectResponse(f"{FRONTEND_URL}?linkedin=error&message=token_failed")

        access_token = token_data["access_token"]

        # Get user info
        headers = {"Authorization": f"Bearer {access_token}"}
        user_info = requests.get("https://api.linkedin.com/v2/userinfo", headers=headers).json()
        linkedin_id = user_info.get("sub")

        if not linkedin_id:
            return RedirectResponse(f"{FRONTEND_URL}?linkedin=error&message=no_user_id")

        # Save or update user in DB
        existing_user = db.query(LinkedInUser).filter(LinkedInUser.linkedin_id == linkedin_id).first()
        if existing_user:
            existing_user.access_token = access_token
        else:
            user = LinkedInUser(linkedin_id=linkedin_id, access_token=access_token)
            db.add(user)
        db.commit()

        # Redirect back to frontend with success
        return RedirectResponse(f"{FRONTEND_URL}?linkedin=success")

    except Exception as e:
        return RedirectResponse(f"{FRONTEND_URL}?linkedin=error&message={str(e)}")


# 🔹 Check if a LinkedIn account is connected
@router.get("/status")
def status(db: Session = Depends(get_db)):
    user = db.query(LinkedInUser).first()
    if user:
        return {"connected": True, "linkedin_id": user.linkedin_id}
    return {"connected": False}


# 🔹 Disconnect LinkedIn account
@router.delete("/disconnect")
def disconnect(db: Session = Depends(get_db)):
    user = db.query(LinkedInUser).first()
    if not user:
        raise HTTPException(status_code=404, detail="No LinkedIn account connected.")
    db.delete(user)
    db.commit()
    return {"message": "LinkedIn account disconnected successfully."}


# 🔹 Helper: Register an image upload with LinkedIn
def register_image_upload(access_token: str, linkedin_id: str):
    """Step 1 of LinkedIn image posting: register the upload to get an upload URL and asset."""
    url = "https://api.linkedin.com/v2/assets?action=registerUpload"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    body = {
        "registerUploadRequest": {
            "recipes": ["urn:li:digitalmediaRecipe:feedshare-image"],
            "owner": f"urn:li:person:{linkedin_id}",
            "serviceRelationships": [
                {
                    "relationshipType": "OWNER",
                    "identifier": "urn:li:userGeneratedContent",
                }
            ],
        }
    }

    res = requests.post(url, headers=headers, json=body)
    print(f"[DEBUG] Register upload response: {res.status_code} - {res.text}")

    if res.status_code != 200:
        raise HTTPException(
            status_code=res.status_code,
            detail=f"Failed to register image upload: {res.text}",
        )

    data = res.json()
    upload_url = data["value"]["uploadMechanism"][
        "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ]["uploadUrl"]
    asset = data["value"]["asset"]

    return upload_url, asset


# 🔹 Helper: Upload the actual image binary to LinkedIn
def upload_image_binary(upload_url: str, image_bytes: bytes, access_token: str):
    """Step 2 of LinkedIn image posting: upload the raw image bytes."""
    headers = {
        "Authorization": f"Bearer {access_token}",
    }

    res = requests.put(upload_url, headers=headers, data=image_bytes)
    print(f"[DEBUG] Image upload response: {res.status_code}")

    if res.status_code not in (200, 201):
        raise HTTPException(
            status_code=res.status_code,
            detail=f"Failed to upload image to LinkedIn: {res.text}",
        )


# 🔹 Step 3: Post Content (text only OR text + image)
@router.post("/post")
async def post(
    text: str = Form(...),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
):
    user = db.query(LinkedInUser).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="No LinkedIn account connected. Please connect first.",
        )

    access_token = user.access_token
    linkedin_id = user.linkedin_id

    headers = {
        "Authorization": f"Bearer {access_token}",
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json",
    }

    # Build the share content based on whether an image is provided
    if image and image.filename:
        # --- Image + Text Post ---
        print(f"[DEBUG] Uploading image: {image.filename} ({image.content_type})")

        # Step 1: Register upload
        upload_url, asset = register_image_upload(access_token, linkedin_id)

        # Step 2: Upload image binary
        image_bytes = await image.read()
        upload_image_binary(upload_url, image_bytes, access_token)

        # Step 3: Create post with image
        share_content = {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text},
                "shareMediaCategory": "IMAGE",
                "media": [
                    {
                        "status": "READY",
                        "media": asset,
                    }
                ],
            }
        }
    else:
        # --- Text-only Post ---
        share_content = {
            "com.linkedin.ugc.ShareContent": {
                "shareCommentary": {"text": text},
                "shareMediaCategory": "NONE",
            }
        }

    data = {
        "author": f"urn:li:person:{linkedin_id}",
        "lifecycleState": "PUBLISHED",
        "specificContent": share_content,
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }

    url = "https://api.linkedin.com/v2/ugcPosts"
    response = requests.post(url, headers=headers, json=data)
    print(f"[DEBUG] Post response: {response.status_code} - {response.text}")

    if response.status_code != 201:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"LinkedIn API error: {response.text}",
        )

    return {"message": "Posted successfully!", "response": response.json()}