from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import Any
import os
import shutil

from db.session import get_db
from models.user import User
from models.document import Document
from api.deps import get_current_user
from rag.pipeline import process_and_store_document, delete_document_from_vectorstore

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/", response_model=Any)
async def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if not file.filename.endswith((".pdf", ".txt")):
        raise HTTPException(status_code=400, detail="Only PDF and TXT files are supported")
    
    file_path = os.path.join(UPLOAD_DIR, f"{current_user.id}_{file.filename}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    document = Document(
        user_id=current_user.id,
        filename=file.filename,
        file_path=file_path,
        file_type=file.filename.split('.')[-1]
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    
    try:
        num_chunks = process_and_store_document(file_path, document.id)
    except Exception as e:
        db.delete(document)
        db.commit()
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Error processing document: {str(e)}")
        
    return {"id": document.id, "filename": document.filename, "chunks": num_chunks}

@router.get("/", response_model=Any)
def get_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    docs = db.query(Document).filter(Document.user_id == current_user.id).all()
    return [{"id": d.id, "filename": d.filename, "created_at": d.created_at} for d in docs]

@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    document = db.query(Document).filter(Document.id == document_id, Document.user_id == current_user.id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if os.path.exists(document.file_path):
        os.remove(document.file_path)
        
    delete_document_from_vectorstore(document_id)
    
    db.delete(document)
    db.commit()
    
    return {"status": "success", "message": "Document deleted"}
