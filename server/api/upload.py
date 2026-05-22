from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import Any
import os
import uuid
import json

from db.session import get_db
from models.user import User
from models.document import Document, DocumentChunk
from models.chat import ChatSession
from api.deps import get_current_user
from rag.pipeline import process_and_store_document_async, delete_document_from_vectorstore

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 10MB max file size
MAX_FILE_SIZE = 10 * 1024 * 1024


async def _index_document(
    db: Session,
    document: Document,
    current_user: User,
    session_id: int | None = None,
) -> int:
    delete_document_from_vectorstore(document.id, current_user.id)
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete()
    document.status = "processing"
    document.embedding_namespace = f"user_{current_user.id}"
    db.commit()

    chunk_records = await process_and_store_document_async(
        document.file_path,
        document.id,
        current_user.id,
        document.filename,
        session_id=session_id,
    )
    for record in chunk_records:
        db.add(
            DocumentChunk(
                document_id=document.id,
                chunk_text=record["chunk_text"],
                embedding_id=record["embedding_id"],
                chunk_metadata=json.dumps(record["metadata"]),
            )
        )

    document.status = "indexed"
    document.chunk_count = len(chunk_records)
    db.commit()
    db.refresh(document)
    return len(chunk_records)


@router.post("/", response_model=Any)
async def upload_document(
    file: UploadFile = File(...),
    session_id: int | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    if not file.filename.lower().endswith((".pdf", ".txt")):
        raise HTTPException(
            status_code=400, detail="Only PDF and TXT files are supported"
        )

    # Read file and check size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400, detail="File size exceeds 10MB limit"
        )

    # Sanitize filename
    safe_filename = (
        file.filename.replace(" ", "_")
        .replace("/", "_")
        .replace("\\", "_")
    )
    file_path = os.path.join(UPLOAD_DIR, f"{current_user.id}_{uuid.uuid4().hex}_{safe_filename}")

    with open(file_path, "wb") as buffer:
        buffer.write(content)

    document = Document(
        user_id=current_user.id,
        filename=file.filename,
        file_path=file_path,
        file_type=file.filename.split(".")[-1].lower(),
        embedding_namespace=f"user_{current_user.id}",
        status="processing",
        document_metadata=json.dumps({"original_filename": file.filename}),
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    try:
        num_chunks = await _index_document(db, document, current_user, session_id=session_id)

        if session_id:
            session = (
                db.query(ChatSession)
                .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
                .first()
            )
            if session and document not in session.documents:
                session.documents.append(document)
                session.document_id = document.id
                session.active_document_ids = json.dumps(
                    sorted({document.id, *[doc.id for doc in session.documents]})
                )

        db.commit()
    except Exception as e:
        delete_document_from_vectorstore(document.id, current_user.id)
        db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete()
        db.delete(document)
        db.commit()
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=500, detail=f"Error processing document: {str(e)}"
        )

    return {
        "id": document.id,
        "filename": document.filename,
        "chunks": num_chunks,
        "status": document.status,
        "embedding_namespace": document.embedding_namespace,
        "created_at": document.created_at,
        "updated_at": document.updated_at,
    }


@router.get("/", response_model=Any)
def get_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "file_type": d.file_type,
            "created_at": d.created_at,
            "status": d.status,
            "chunk_count": d.chunk_count,
            "embedding_namespace": d.embedding_namespace,
            "updated_at": d.updated_at,
        }
        for d in docs
    ]


@router.post("/{document_id}/reindex", response_model=Any)
async def reindex_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="Stored file is missing")

    try:
        num_chunks = await _index_document(db, document, current_user)
    except Exception as e:
        document.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Error reindexing document: {str(e)}")

    return {
        "id": document.id,
        "filename": document.filename,
        "chunks": num_chunks,
        "status": document.status,
        "embedding_namespace": document.embedding_namespace,
        "created_at": document.created_at,
        "updated_at": document.updated_at,
    }


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if os.path.exists(document.file_path):
        os.remove(document.file_path)

    delete_document_from_vectorstore(document_id, current_user.id)

    sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).all()
    for session in sessions:
        active_ids = []
        try:
            active_ids = [int(item) for item in json.loads(session.active_document_ids or "[]")]
        except (TypeError, ValueError, json.JSONDecodeError):
            active_ids = []
        if document_id in active_ids or session.document_id == document_id:
            remaining_ids = [item for item in active_ids if item != document_id]
            session.documents = [item for item in session.documents if item.id != document_id]
            session.active_document_ids = json.dumps(remaining_ids)
            if session.document_id == document_id:
                session.document_id = remaining_ids[0] if remaining_ids else None

    db.delete(document)
    db.commit()

    return {"status": "success", "message": "Document deleted"}
