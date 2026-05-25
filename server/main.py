from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Request
from sqlalchemy import inspect, text
from models.database import Base
from db.session import engine, SessionLocal
import json

from api import auth, upload, chat, sessions, groups, study
from models.document import Document, DocumentChunk
from rag.pipeline import repair_user_vector_metadata

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
            migrations.append("ALTER TABLE documents ADD COLUMN updated_at DATETIME")

    if "chat_sessions" in table_names:
        session_columns = {column["name"] for column in inspector.get_columns("chat_sessions")}
        if "active_document_ids" not in session_columns:
            migrations.append("ALTER TABLE chat_sessions ADD COLUMN active_document_ids TEXT NOT NULL DEFAULT '[]'")
        if "active_group_ids" not in session_columns:
            migrations.append("ALTER TABLE chat_sessions ADD COLUMN active_group_ids TEXT NOT NULL DEFAULT '[]'")

    if "document_groups" in table_names:
        group_columns = {column["name"] for column in inspector.get_columns("document_groups")}
        if "sort_order" not in group_columns:
            migrations.append("ALTER TABLE document_groups ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")

    if migrations:
        with engine.begin() as connection:
            for migration in migrations:
                connection.execute(text(migration))

    if "documents" in table_names:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "UPDATE documents "
                    "SET updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)"
                )
            )
            connection.execute(
                text(
                    "UPDATE documents "
                    "SET status = 'needs_reindex' "
                    "WHERE COALESCE(chunk_count, 0) = 0 AND status = 'indexed'"
                )
            )
            connection.execute(
                text(
                    "UPDATE documents "
                    "SET status = 'orphaned' "
                    "WHERE user_id IS NULL"
                )
            )

    repair_document_metadata()


def repair_document_metadata():
    db = SessionLocal()
    try:
        documents = db.query(Document).filter(Document.user_id.isnot(None)).all()
        by_user: dict[int, dict[int, dict]] = {}

        for document in documents:
            group_ids = sorted({group.id for group in document.groups if group.user_id == document.user_id})
            upload_timestamp = (
                document.created_at.isoformat()
                if hasattr(document.created_at, "isoformat")
                else str(document.created_at)
            )
            payload = {
                "filename": document.filename,
                "group_ids": group_ids,
                "upload_timestamp": upload_timestamp,
            }
            by_user.setdefault(document.user_id, {})[document.id] = payload

            chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).all()
            for chunk in chunks:
                try:
                    metadata = json.loads(chunk.chunk_metadata or "{}")
                except json.JSONDecodeError:
                    metadata = {}
                metadata.update(
                    {
                        "user_id": document.user_id,
                        "document_id": document.id,
                        "filename": document.filename,
                        "session_id": metadata.get("session_id"),
                        "group_ids": group_ids,
                        "group_id": group_ids[0] if group_ids else None,
                        "upload_timestamp": metadata.get("upload_timestamp") or upload_timestamp,
                        "created_at": metadata.get("created_at") or metadata.get("upload_timestamp") or upload_timestamp,
                        "embedding_version": metadata.get("embedding_version") or "huggingface:all-MiniLM-L6-v2:v1",
                        "section_title": metadata.get("section_title") or metadata.get("section_heading"),
                        "section_heading": metadata.get("section_title") or metadata.get("section_heading"),
                        "chunk_type": metadata.get("chunk_type") or "section",
                        "topic": metadata.get("topic"),
                        "keywords": metadata.get("keywords") or [],
                        "document_type": metadata.get("document_type") or "notes",
                    }
                )
                chunk.chunk_metadata = json.dumps(metadata)

        db.commit()

        for user_id, payload in by_user.items():
            repair_user_vector_metadata(user_id, payload)
    finally:
        db.close()


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
app.include_router(groups.router, prefix="/groups", tags=["groups"])
app.include_router(study.router, prefix="/study", tags=["study"])


@app.get("/health")
def health_check():
    return {"status": "ok", "version": "2.0.0"}
