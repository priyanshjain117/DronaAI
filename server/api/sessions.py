from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Any
from pydantic import BaseModel
import json

from db.session import get_db
from models.user import User
from models.chat import ChatSession, ChatMessage, RetrievalMetadata
from models.document import Document, DocumentGroup
from api.deps import get_current_user

router = APIRouter()


class SessionRename(BaseModel):
    title: str


class SessionCreate(BaseModel):
    document_ids: list[int] = []
    group_ids: list[int] = []


class SessionDocumentsUpdate(BaseModel):
    document_ids: list[int]


class SessionGroupsUpdate(BaseModel):
    group_ids: list[int]


def _parse_document_ids(value: str | None) -> list[int]:
    try:
        parsed = json.loads(value or "[]")
        return [int(item) for item in parsed if item is not None]
    except (TypeError, ValueError, json.JSONDecodeError):
        return []


def _document_payload(document: Document) -> dict[str, Any]:
    return {
        "id": document.id,
        "filename": document.filename,
        "status": document.status,
        "chunk_count": document.chunk_count,
        "created_at": document.created_at,
        "updated_at": document.updated_at,
    }


def _group_payload(group: DocumentGroup) -> dict[str, Any]:
    return {
        "id": group.id,
        "name": group.name,
        "slug": group.slug,
        "mention": f"@{group.slug}",
        "description": group.description,
        "color": group.color,
        "doc_count": len(group.documents),
        "updated_at": group.updated_at,
    }


def _sync_session_documents(
    db: Session,
    session: ChatSession,
    current_user: User,
    document_ids: list[int],
):
    unique_ids = sorted({int(document_id) for document_id in document_ids})
    if not unique_ids:
        session.documents = []
        session.document_id = None
        session.active_document_ids = "[]"
        return []

    documents = (
        db.query(Document)
        .filter(Document.user_id == current_user.id, Document.id.in_(unique_ids))
        .all()
    )
    found_ids = {document.id for document in documents}
    missing_ids = set(unique_ids) - found_ids
    if missing_ids:
        raise HTTPException(status_code=404, detail="One or more documents were not found")

    session.documents = documents
    session.document_id = documents[0].id if documents else None
    session.active_document_ids = json.dumps([document.id for document in documents])
    return documents


def _sync_session_groups(
    db: Session,
    session: ChatSession,
    current_user: User,
    group_ids: list[int],
):
    unique_ids = sorted({int(group_id) for group_id in group_ids})
    if not unique_ids:
        session.active_group_ids = "[]"
        return []

    groups = (
        db.query(DocumentGroup)
        .filter(DocumentGroup.user_id == current_user.id, DocumentGroup.id.in_(unique_ids))
        .all()
    )
    found_ids = {group.id for group in groups}
    if set(unique_ids) - found_ids:
        raise HTTPException(status_code=404, detail="One or more workspaces were not found")

    session.active_group_ids = json.dumps([group.id for group in groups])
    return groups


def _session_payload(session: ChatSession, db: Session | None = None, user_id: int | None = None) -> dict[str, Any]:
    active_ids = _parse_document_ids(session.active_document_ids)
    active_group_ids = _parse_document_ids(session.active_group_ids)
    documents = sorted(session.documents, key=lambda document: active_ids.index(document.id) if document.id in active_ids else 999)
    groups = []
    if db is not None and user_id is not None and active_group_ids:
        groups = (
            db.query(DocumentGroup)
            .filter(DocumentGroup.user_id == user_id, DocumentGroup.id.in_(active_group_ids))
            .all()
        )
        groups = sorted(groups, key=lambda group: active_group_ids.index(group.id) if group.id in active_group_ids else 999)
    return {
        "id": session.id,
        "title": session.title,
        "document_id": session.document_id,
        "active_document_ids": active_ids,
        "active_group_ids": active_group_ids,
        "documents": [_document_payload(document) for document in documents],
        "groups": [_group_payload(group) for group in groups],
        "created_at": session.created_at,
        "updated_at": session.updated_at,
        "message_count": len(session.messages),
    }


@router.post("/", response_model=Any)
def create_session(
    body: SessionCreate | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = ChatSession(user_id=current_user.id, title="New Chat")
    db.add(session)
    db.flush()
    if body and body.document_ids:
        _sync_session_documents(db, session, current_user, body.document_ids)
    if body and body.group_ids:
        _sync_session_groups(db, session, current_user, body.group_ids)
    db.commit()
    db.refresh(session)
    return _session_payload(session, db, current_user.id)


@router.get("/", response_model=Any)
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .all()
    )
    return [_session_payload(s, db, current_user.id) for s in sessions]


@router.get("/{session_id}", response_model=Any)
def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    payload = _session_payload(session, db, current_user.id)
    payload.update({
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at,
                "sources": [
                    {
                        "label": source.source_label,
                        "document_id": source.document_id,
                        "page_number": source.page_number,
                        "section_heading": source.section_heading,
                        "confidence": source.confidence,
                        "relevance": "high" if source.confidence >= 0.72 else "medium" if source.confidence >= 0.55 else "low",
                        "snippet": source.snippet,
                    }
                    for source in db.query(RetrievalMetadata)
                    .filter(RetrievalMetadata.message_id == m.id)
                    .order_by(RetrievalMetadata.confidence.desc())
                    .all()
                ],
            }
            for m in session.messages
        ],
    })
    return payload


@router.patch("/{session_id}", response_model=Any)
def rename_session(
    session_id: int,
    body: SessionRename,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.title = body.title.strip()[:100]
    db.commit()
    db.refresh(session)
    return {
        "id": session.id,
        "title": session.title,
        "updated_at": session.updated_at,
    }


@router.put("/{session_id}/documents", response_model=Any)
def set_session_documents(
    session_id: int,
    body: SessionDocumentsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    _sync_session_documents(db, session, current_user, body.document_ids)
    db.commit()
    db.refresh(session)
    return _session_payload(session, db, current_user.id)


@router.post("/{session_id}/documents/{document_id}", response_model=Any)
def attach_session_document(
    session_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    document = (
        db.query(Document)
        .filter(Document.id == document_id, Document.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    active_ids = set(_parse_document_ids(session.active_document_ids))
    active_ids.add(document.id)
    _sync_session_documents(db, session, current_user, list(active_ids))
    db.commit()
    db.refresh(session)
    return _session_payload(session, db, current_user.id)


@router.delete("/{session_id}/documents/{document_id}", response_model=Any)
def detach_session_document(
    session_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    active_ids = set(_parse_document_ids(session.active_document_ids))
    active_ids.discard(document_id)
    _sync_session_documents(db, session, current_user, list(active_ids))
    db.commit()
    db.refresh(session)
    return _session_payload(session, db, current_user.id)


@router.put("/{session_id}/groups", response_model=Any)
def set_session_groups(
    session_id: int,
    body: SessionGroupsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    _sync_session_groups(db, session, current_user, body.group_ids)
    db.commit()
    db.refresh(session)
    return _session_payload(session, db, current_user.id)


@router.post("/{session_id}/groups/{group_id}", response_model=Any)
def attach_session_group(
    session_id: int,
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    group = (
        db.query(DocumentGroup)
        .filter(DocumentGroup.id == group_id, DocumentGroup.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not group:
        raise HTTPException(status_code=404, detail="Workspace not found")

    active_ids = set(_parse_document_ids(session.active_group_ids))
    active_ids.add(group.id)
    _sync_session_groups(db, session, current_user, list(active_ids))
    db.commit()
    db.refresh(session)
    return _session_payload(session, db, current_user.id)


@router.delete("/{session_id}/groups/{group_id}", response_model=Any)
def detach_session_group(
    session_id: int,
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    active_ids = set(_parse_document_ids(session.active_group_ids))
    active_ids.discard(group_id)
    _sync_session_groups(db, session, current_user, list(active_ids))
    db.commit()
    db.refresh(session)
    return _session_payload(session, db, current_user.id)


@router.delete("/{session_id}")
def delete_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    db.delete(session)
    db.commit()
    return {"status": "success", "message": "Session deleted"}
