from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google import genai
from config import GEMINI_API_KEY
import requests
import subprocess
import shutil
import os
import uuid
from urllib.parse import quote
import random
import base64

router = APIRouter(prefix="/content", tags=["Content"])

client = genai.Client(api_key=GEMINI_API_KEY)

# 👇 CHANGE THE MODEL HERE — Options: "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash", "gemini-2.5-pro"
MODEL_NAME = "gemini-2.5-flash"


class ContentRequest(BaseModel):
    topic: str
    tone: str = "professional"
    length: str = "medium"


class ImageRequest(BaseModel):
    prompt: str



@router.post("/generate")
def generate_content(req: ContentRequest):
    prompt = f"""
You are an expert LinkedIn content writer. Generate a compelling LinkedIn post about the following topic.

Topic: {req.topic}
Tone: {req.tone}
Length: {req.length} (short = 50-100 words, medium = 100-200 words, long = 200-350 words)

Guidelines:
- Start with a strong hook that grabs attention
- Use short paragraphs and line breaks for readability
- Include relevant emojis sparingly
- Add 3-5 relevant hashtags at the end
- Make it engaging and encourage comments
- Do NOT include any markdown formatting, just plain text
- Write it as ready-to-post content
"""

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt
        )
        if response and response.text:
            return {"generated_text": response.text}
        else:
            raise HTTPException(status_code=500, detail="Empty response from Gemini API")
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Gemini API error: {e}")
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")


@router.post("/generate-image")
def generate_image(req: ImageRequest):
    try:
        return _generate_image_impl(req)
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        print(f"CRITICAL ERROR in generate-image: {e}")
        # Write to file so we can read it via tool
        with open("last_error.txt", "w") as f:
            f.write(error_msg)
        return {"image_url": "https://dummyimage.com/600x400/000/fff&text=Error"}

def _generate_image_impl(req: ImageRequest):

    # Use Pollinations.ai (Free, no key required)
    # Curl works, so we mimic it or use simple requests
    print(f"[INFO] Generating image with Pollinations.ai for prompt: {req.prompt}")
    encoded_prompt = quote(req.prompt)
    seed = random.randint(1, 1000000)
    image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?seed={seed}&nologo=true"
    
    # Try backend fetch using PowerShell Invoke-WebRequest (Proven to work where curl/requests fail)
    try:
        # Generate a unique temp filename
        temp_filename = f"temp_image_{uuid.uuid4()}.jpg"
        
        # Construct PowerShell command to download to file (avoids stdout encoding issues)
        # We need a User-Agent that mimics a browser or the default PS one
        ps_command = f"Invoke-WebRequest -Uri '{image_url}' -OutFile '{temp_filename}' -UserAgent 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'"
        
        print(f"[INFO] Downloading via PowerShell: {image_url}")
        subprocess.run(["powershell", "-Command", ps_command], check=True, timeout=45)
        
        if os.path.exists(temp_filename):
            with open(temp_filename, "rb") as f:
                img_data = f.read()
            
            # Clean up temp file
            os.remove(temp_filename)
            
            # Verify magic bytes (JPEG/PNG)
            if len(img_data) > 1000 and (img_data.startswith(b'\xff\xd8') or img_data.startswith(b'\x89PNG')):
                print("[INFO] PowerShell download successful!")
                img_base64 = base64.b64encode(img_data).decode('utf-8')
                return {"image_base64": f"data:image/jpeg;base64,{img_base64}"}
            else:
                print(f"[WARNING] Downloaded content invalid or too small. First bytes: {img_data[:20]}")
        else:
            print("[WARNING] Temp file not found after PowerShell command.")

    except Exception as ps_e:
        print(f"[ERROR] PowerShell download failed: {ps_e}")
        # Clean up if exists
        if 'temp_filename' in locals() and os.path.exists(temp_filename):
            os.remove(temp_filename)

    # Fallback to requests (likely to fail with 530, but worth a shot if PS fails)
    try:
        print("[INFO] Falling back to requests...")
        headers = {"User-Agent": "curl/7.68.0"} 
        response = requests.get(image_url, headers=headers, timeout=30)
        
        if response.status_code == 200:
            img_base64 = base64.b64encode(response.content).decode('utf-8')
            return {"image_base64": f"data:image/jpeg;base64,{img_base64}"}
        else:
             print(f"[ERROR] Pollinations failed with status: {response.status_code}")
             
             # FALLBACK to Lexica.art (Search existing AI images)
             print(f"[INFO] Falling back to Lexica.art search for: {req.prompt}")
             try:
                 lexica_url = f"https://lexica.art/api/v1/search?q={quote(req.prompt)}"
                 lex_res = requests.get(lexica_url, headers=headers, timeout=30)
                 if lex_res.status_code == 200:
                     data = lex_res.json()
                     if data.get("images"):
                         # Pick the first image
                         best_image = data["images"][0]
                         image_src = best_image.get("src")
                         if image_src:
                             print(f"[INFO] Found Lexica image: {image_src}")
                             # Try to download it (to convert to base64) or return URL
                             # Lexica images are usually accessible. Let's return URL as safest fallback.
                             return {"image_url": image_src}
             except Exception as lex_e:
                 print(f"[ERROR] Lexica fallback failed: {lex_e}")

             # If everything fails, return the original Pollinations URL (though it might be blocked)
             return {"image_url": image_url}
    except Exception as e:
        print(f"[ERROR] Backend fetch failed: {e}")
        return {"image_url": image_url}

