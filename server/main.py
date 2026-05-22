from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request
from sqlalchemy import inspect, text
from models.database import Base
from db.session import engine

from api import auth, upload, chat, sessions

# Create database tables
Base.metadata.create_all(bind=engine)


def ensure_sqlite_schema():
    """Small local migration layer for the SQLite MVP database.

    SQLAlchemy create_all creates new tables but does not add columns to tables
    that already exist. These guarded ALTERs keep existing dev databases usable.
    """
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    migrations = []

    if "documents" in table_names:
        document_columns = {column["name"] for column in inspector.get_columns("documents")}
        if "embedding_namespace" not in document_columns:
            migrations.append("ALTER TABLE documents ADD COLUMN embedding_namespace VARCHAR")
        if "status" not in document_columns:
            migrations.append("ALTER TABLE documents ADD COLUMN status VARCHAR NOT NULL DEFAULT 'indexed'")
        if "chunk_count" not in document_columns:
            migrations.append("ALTER TABLE documents ADD COLUMN chunk_count INTEGER NOT NULL DEFAULT 0")
        if "document_metadata" not in document_columns:
            migrations.append("ALTER TABLE documents ADD COLUMN document_metadata TEXT NOT NULL DEFAULT '{}'")
        if "updated_at" not in document_columns:
            migrations.append("ALTER TABLE documents ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP")

    if "chat_sessions" in table_names:
        session_columns = {column["name"] for column in inspector.get_columns("chat_sessions")}
        if "active_document_ids" not in session_columns:
            migrations.append("ALTER TABLE chat_sessions ADD COLUMN active_document_ids TEXT NOT NULL DEFAULT '[]'")

    if migrations:
        with engine.begin() as connection:
            for migration in migrations:
                connection.execute(text(migration))

    if "documents" in table_names:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "UPDATE documents "
                    "SET status = 'needs_reindex' "
                    "WHERE COALESCE(chunk_count, 0) = 0 AND status = 'indexed'"
                )
            )


ensure_sqlite_schema()

app = FastAPI(
    title="DronaAI Study Assistant API",
    description="AI-powered study assistant with RAG pipeline",
    version="2.0.0",
)

# Setup CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return a clean JSON error."""
    print(f"Unhandled error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again."},
    )


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(upload.router, prefix="/upload", tags=["upload"])
app.include_router(chat.router, prefix="/chat", tags=["chat"])
app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "2.0.0"}
