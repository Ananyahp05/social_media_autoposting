from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from urllib.parse import quote
from typing import Optional
import requests
import os

from db import get_db
from models import InstagramUser, User
from config import INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI, FRONTEND_URL
from routes.auth import get_current_user

router = APIRouter(prefix="/instagram", tags=["Instagram"])


# 🔹 Step 1: Login — redirects user to Facebook OAuth for Instagram permissions
@router.get("/login")
def login(current_user: User = Depends(get_current_user)):
    scopes = "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement"
    state = current_user.email
    encoded_redirect = quote(INSTAGRAM_REDIRECT_URI, safe="")
    url = (
        "https://www.facebook.com/v21.0/dialog/oauth"
        f"?client_id={INSTAGRAM_APP_ID}"
        f"&redirect_uri={encoded_redirect}"
        f"&scope={scopes}"
        f"&state={state}"
        "&response_type=code"
    )
    print(f"[DEBUG] Instagram OAuth URL: {url}")
    return {"auth_url": url}


# 🔹 Step 2: Callback — Facebook redirects here after user approves
@router.get("/callback")
def callback(code: str, state: str, db: Session = Depends(get_db)):
    try:
        print(f"[DEBUG] Instagram callback received with code: {code[:10]}...")

        # Exchange code for short-lived access token
        token_url = "https://graph.facebook.com/v21.0/oauth/access_token"
        params = {
            "client_id": INSTAGRAM_APP_ID,
            "client_secret": INSTAGRAM_APP_SECRET,
            "redirect_uri": INSTAGRAM_REDIRECT_URI,
            "code": code,
        }

        res = requests.get(token_url, params=params)
        token_data = res.json()
        print(f"[DEBUG] Token response: {res.status_code} - {token_data}")

        if "access_token" not in token_data:
            error_msg = token_data.get("error", {}).get("message", "Token exchange failed")
            return RedirectResponse(f"{FRONTEND_URL}?instagram=error&message={quote(error_msg)}")

        short_token = token_data["access_token"]

        # Exchange for long-lived token (60 days)
        long_token_url = "https://graph.facebook.com/v21.0/oauth/access_token"
        long_params = {
            "grant_type": "fb_exchange_token",
            "client_id": INSTAGRAM_APP_ID,
            "client_secret": INSTAGRAM_APP_SECRET,
            "fb_exchange_token": short_token,
        }

        long_res = requests.get(long_token_url, params=long_params)
        long_data = long_res.json()
        access_token = long_data.get("access_token", short_token)
        print(f"[DEBUG] Long-lived token obtained: {bool(long_data.get('access_token'))}")

        # Get Facebook Pages the user manages
        pages_url = "https://graph.facebook.com/v21.0/me/accounts"
        headers = {"Authorization": f"Bearer {access_token}"}
        pages_res = requests.get(pages_url, headers=headers)
        pages_data = pages_res.json()
        print(f"[DEBUG] Pages response: {pages_data}")

        pages = pages_data.get("data", [])
        if not pages:
            return RedirectResponse(
                f"{FRONTEND_URL}?instagram=error&message={quote('No Facebook Pages found. Your Instagram must be linked to a Facebook Page.')}"
            )

        # Use the first page's access token
        page_id = pages[0]["id"]
        page_access_token = pages[0]["access_token"]

        # Get the Instagram Business Account linked to this page
        ig_url = f"https://graph.facebook.com/v21.0/{page_id}?fields=instagram_business_account"
        ig_res = requests.get(ig_url, headers={"Authorization": f"Bearer {page_access_token}"})
        ig_data = ig_res.json()
        print(f"[DEBUG] Instagram business account: {ig_data}")

        ig_account = ig_data.get("instagram_business_account")
        if not ig_account:
            return RedirectResponse(
                f"{FRONTEND_URL}?instagram=error&message={quote('No Instagram Business account linked to your Facebook Page. Please convert your Instagram to a Business or Creator account.')}"
            )

        ig_user_id = ig_account["id"]

        # Get Instagram username
        ig_info_url = f"https://graph.facebook.com/v21.0/{ig_user_id}?fields=username"
        ig_info_res = requests.get(ig_info_url, headers={"Authorization": f"Bearer {page_access_token}"})
        ig_info = ig_info_res.json()
        ig_username = ig_info.get("username", "")
        print(f"[DEBUG] Instagram connected: @{ig_username} (ID: {ig_user_id})")

        # Save or update user in DB (store page access token, as it has IG permissions)
        existing_user = db.query(InstagramUser).filter(
            InstagramUser.user_email == state
        ).first()

        if existing_user:
            existing_user.access_token = page_access_token
            existing_user.username = ig_username
            existing_user.instagram_user_id = ig_user_id
        else:
            user = InstagramUser(
                user_email=state,
                instagram_user_id=ig_user_id,
                access_token=page_access_token,
                username=ig_username,
            )
            db.add(user)
        db.commit()

        return RedirectResponse(f"{FRONTEND_URL}?instagram=success")

    except Exception as e:
        print(f"[ERROR] Instagram callback: {e}")
        return RedirectResponse(f"{FRONTEND_URL}?instagram=error&message={quote(str(e))}")


# 🔹 Check if an Instagram account is connected
@router.get("/status")
def status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = db.query(InstagramUser).filter(InstagramUser.user_email == current_user.email).first()
    if user:
        return {"connected": True, "username": user.username}
    return {"connected": False}


# 🔹 Disconnect Instagram account
@router.delete("/disconnect")
def disconnect(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = db.query(InstagramUser).filter(InstagramUser.user_email == current_user.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No Instagram account connected.")
    db.delete(user)
    db.commit()
    return {"message": "Instagram account disconnected successfully."}


# 🔹 Post to Instagram (image required — Instagram API does not support text-only posts)
@router.post("/post")
async def post(
    text: str = Form(...),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(InstagramUser).filter(InstagramUser.user_email == current_user.email).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="No Instagram account connected. Please connect first.",
        )

    if not image or not image.filename:
        raise HTTPException(
            status_code=400,
            detail="Instagram requires an image for every post. Please attach an image.",
        )

    access_token = user.access_token
    ig_user_id = user.instagram_user_id

    # Read image bytes
    image_bytes = await image.read()

    # Step 1: Upload image to a publicly accessible URL
    # Instagram Graph API requires a public image URL, so we use Facebook's photo upload
    # We upload to the page's photos as unpublished, then use that URL
    upload_url = f"https://graph.facebook.com/v21.0/{ig_user_id}/media"

    # For Instagram Graph API, we need to host the image at a public URL
    # We'll use imgbb or similar service. Alternative: upload to Facebook first
    # Simplest approach: use a temporary image hosting service
    
    # Upload image to tmpfiles.org (free, temporary hosting)
    try:
        upload_res = requests.post(
            "https://tmpfiles.org/api/v1/upload",
            files={"file": (image.filename, image_bytes, image.content_type or "image/jpeg")},
        )
        upload_data = upload_res.json()
        print(f"[DEBUG] Image upload response: {upload_data}")

        if upload_data.get("status") != "success":
            raise HTTPException(status_code=500, detail="Failed to upload image to temporary hosting.")

        # tmpfiles.org returns URL like https://tmpfiles.org/12345/image.jpg
        # We need to convert it to direct link: https://tmpfiles.org/dl/12345/image.jpg
        temp_url = upload_data["data"]["url"]
        direct_url = temp_url.replace("tmpfiles.org/", "tmpfiles.org/dl/")
        print(f"[DEBUG] Image direct URL: {direct_url}")

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Image upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")

    # Step 2: Create Instagram media container
    container_params = {
        "image_url": direct_url,
        "caption": text,
        "access_token": access_token,
    }

    container_res = requests.post(
        f"https://graph.facebook.com/v21.0/{ig_user_id}/media",
        data=container_params,
    )
    container_data = container_res.json()
    print(f"[DEBUG] Container response: {container_res.status_code} - {container_data}")

    if "id" not in container_data:
        error_msg = container_data.get("error", {}).get("message", "Failed to create media container")
        raise HTTPException(status_code=400, detail=f"Instagram API error: {error_msg}")

    creation_id = container_data["id"]

    # Step 3: Publish the media container
    publish_params = {
        "creation_id": creation_id,
        "access_token": access_token,
    }

    publish_res = requests.post(
        f"https://graph.facebook.com/v21.0/{ig_user_id}/media_publish",
        data=publish_params,
    )
    publish_data = publish_res.json()
    print(f"[DEBUG] Publish response: {publish_res.status_code} - {publish_data}")

    if "id" not in publish_data:
        error_msg = publish_data.get("error", {}).get("message", "Failed to publish post")
        raise HTTPException(status_code=400, detail=f"Instagram publish error: {error_msg}")

    return {"message": "Posted to Instagram successfully!", "post_id": publish_data["id"]}
