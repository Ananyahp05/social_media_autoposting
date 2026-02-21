from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db import engine, Base
from routes import linkedin, content, twitter, auth, instagram

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(linkedin.router)
app.include_router(content.router)
app.include_router(twitter.router)
app.include_router(auth.router)
app.include_router(instagram.router)

@app.get("/")
def home():
    return {"message": "Social Media Poster v2 Running", "status": "online"}

@app.get("/health")
def health():
    return {"status": "ok"}