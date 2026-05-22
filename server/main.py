from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.database import Base
from db.session import engine

from api import auth, upload, chat

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="DronaAI Study Assistant API")

# Setup CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(upload.router, prefix="/upload", tags=["upload"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])

@app.get("/health")
def health_check():
    return {"status": "ok"}
