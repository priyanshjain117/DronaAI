import re
import json
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.deps import get_current_user
from db.session import get_db
from models.chat import ChatSession
from models.document import Document, DocumentChunk, DocumentGroup
from models.user import User
from rag.pipeline import sync_document_group_metadata

router = APIRouter()


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=500)
    color: str = Field(default="#F97316", max_length=24)
    document_ids: list[int] = []


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)
    color: str | None = Field(default=None, max_length=24)
    memory: str | None = Field(default=None, max_length=4000)
    retrieval_preferences: str | None = Field(default=None, max_length=4000)


class GroupDocumentsUpdate(BaseModel):
    document_ids: list[int]


class GroupOrderUpdate(BaseModel):
    group_ids: list[int]


def _slugify(name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", name.strip().lower()).strip("-")
    return slug or "workspace"


def _unique_slug(db: Session, user_id: int, name: str, group_id: int | None = None) -> str:
    base = _slugify(name)
    slug = base
    counter = 2
    while True:
        query = db.query(DocumentGroup).filter(DocumentGroup.user_id == user_id, DocumentGroup.slug == slug)
        if group_id is not None:
            query = query.filter(DocumentGroup.id != group_id)
        if not query.first():
            return slug
        slug = f"{base}-{counter}"
        counter += 1


def _owned_group(db: Session, user_id: int, group_id: int) -> DocumentGroup:
    group = (
        db.query(DocumentGroup)
        .filter(DocumentGroup.id == group_id, DocumentGroup.user_id == user_id)
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return group


def _owned_documents(db: Session, user_id: int, document_ids: list[int]) -> list[Document]:
    unique_ids = sorted({int(document_id) for document_id in document_ids})
    if not unique_ids:
        return []

    documents = (
        db.query(Document)
        .filter(Document.user_id == user_id, Document.id.in_(unique_ids))
        .all()
    )
    found_ids = {document.id for document in documents}
    if set(unique_ids) - found_ids:
        raise HTTPException(status_code=404, detail="One or more documents were not found")
    return documents


def _group_payload(group: DocumentGroup) -> dict[str, Any]:
    documents = sorted(group.documents, key=lambda document: document.filename.lower())
    return {
        "id": group.id,
        "name": group.name,
        "slug": group.slug,
        "mention": f"@{group.slug}",
        "description": group.description,
        "color": group.color,
        "memory": group.memory,
        "retrieval_preferences": group.retrieval_preferences,
        "sort_order": group.sort_order,
        "created_at": group.created_at,
        "updated_at": group.updated_at,
        "doc_count": len(documents),
        "documents": [
            {
                "id": document.id,
                "filename": document.filename,
                "status": document.status,
                "chunk_count": document.chunk_count,
                "created_at": document.created_at,
                "updated_at": document.updated_at,
            }
            for document in documents
        ],
    }


def _sync_document_group_metadata(db: Session, user_id: int, documents: list[Document]):
    for document in documents:
        group_ids = sorted({group.id for group in document.groups if group.user_id == user_id})
        chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).all()
        for chunk in chunks:
            try:
                metadata = json.loads(chunk.chunk_metadata or "{}")
            except json.JSONDecodeError:
                metadata = {}
            metadata["group_ids"] = group_ids
            metadata["group_id"] = group_ids[0] if group_ids else None
            chunk.chunk_metadata = json.dumps(metadata)
        sync_document_group_metadata(document.id, user_id, group_ids)


@router.get("/", response_model=Any)
def list_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    groups = (
        db.query(DocumentGroup)
        .filter(DocumentGroup.user_id == current_user.id)
        .order_by(DocumentGroup.sort_order.asc(), DocumentGroup.updated_at.desc())
        .all()
    )
    return [_group_payload(group) for group in groups]


@router.post("/", response_model=Any)
def create_group(
    body: GroupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    documents = _owned_documents(db, current_user.id, body.document_ids)
    next_order = db.query(DocumentGroup).filter(DocumentGroup.user_id == current_user.id).count()
    group = DocumentGroup(
        user_id=current_user.id,
        name=body.name.strip(),
        slug=_unique_slug(db, current_user.id, body.name),
        description=body.description.strip(),
        color=body.color,
        sort_order=next_order,
    )
    group.documents = documents
    db.add(group)
    db.flush()
    _sync_document_group_metadata(db, current_user.id, documents)
    db.commit()
    db.refresh(group)
    return _group_payload(group)


@router.patch("/{group_id}", response_model=Any)
def update_group(
    group_id: int,
    body: GroupUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = _owned_group(db, current_user.id, group_id)
    if body.name is not None:
        group.name = body.name.strip()
        group.slug = _unique_slug(db, current_user.id, body.name, group_id=group.id)
    if body.description is not None:
        group.description = body.description.strip()
    if body.color is not None:
        group.color = body.color
    if body.memory is not None:
        group.memory = body.memory.strip()
    if body.retrieval_preferences is not None:
        group.retrieval_preferences = body.retrieval_preferences
    db.commit()
    db.refresh(group)
    return _group_payload(group)


@router.put("/{group_id}/documents", response_model=Any)
def set_group_documents(
    group_id: int,
    body: GroupDocumentsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = _owned_group(db, current_user.id, group_id)
    previous_documents = list(group.documents)
    group.documents = _owned_documents(db, current_user.id, body.document_ids)
    db.flush()
    _sync_document_group_metadata(db, current_user.id, list({document.id: document for document in [*previous_documents, *group.documents]}.values()))
    db.commit()
    db.refresh(group)
    return _group_payload(group)


@router.post("/{group_id}/documents/{document_id}", response_model=Any)
def add_group_document(
    group_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = _owned_group(db, current_user.id, group_id)
    document = _owned_documents(db, current_user.id, [document_id])[0]
    if document not in group.documents:
        group.documents.append(document)
    db.flush()
    _sync_document_group_metadata(db, current_user.id, [document])
    db.commit()
    db.refresh(group)
    return _group_payload(group)


@router.delete("/{group_id}/documents/{document_id}", response_model=Any)
def remove_group_document(
    group_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = _owned_group(db, current_user.id, group_id)
    removed_documents = [document for document in group.documents if document.id == document_id]
    group.documents = [document for document in group.documents if document.id != document_id]
    db.flush()
    _sync_document_group_metadata(db, current_user.id, removed_documents)
    db.commit()
    db.refresh(group)
    return _group_payload(group)


@router.put("/order", response_model=Any)
def reorder_groups(
    body: GroupOrderUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    groups = (
        db.query(DocumentGroup)
        .filter(DocumentGroup.user_id == current_user.id, DocumentGroup.id.in_(body.group_ids))
        .all()
    )
    groups_by_id = {group.id: group for group in groups}
    if set(body.group_ids) - set(groups_by_id):
        raise HTTPException(status_code=404, detail="One or more workspaces were not found")
    for index, group_id in enumerate(body.group_ids):
        groups_by_id[group_id].sort_order = index
    db.commit()
    return {"status": "success"}


@router.delete("/{group_id}")
def delete_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    group = _owned_group(db, current_user.id, group_id)
    affected_documents = list(group.documents)
    group.documents = []
    db.flush()
    _sync_document_group_metadata(db, current_user.id, affected_documents)
    sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).all()
    for session in sessions:
        try:
            active_group_ids = [int(item) for item in json.loads(session.active_group_ids or "[]")]
        except (TypeError, ValueError, json.JSONDecodeError):
            active_group_ids = []
        if group_id in active_group_ids:
            session.active_group_ids = json.dumps([item for item in active_group_ids if item != group_id])
    db.delete(group)
    db.commit()
    return {"status": "success", "message": "Workspace deleted"}
