import json
import os
import re
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from api.deps import get_current_user
from db.session import get_db
from models.document import Document, DocumentGroup
from models.study import StudyMaterial, StudyProgress
from models.user import User
from rag.pipeline import retrieve_context

router = APIRouter()


StudyTool = Literal["summary", "flashcards", "mcq", "revision"]


class StudyGenerateRequest(BaseModel):
    tool: StudyTool
    mode: str = Field(default="exam", max_length=60)
    difficulty: str = Field(default="medium", max_length=24)
    query: str = Field(default="", max_length=2000)
    document_ids: list[int] = []
    group_ids: list[int] = []
    count: int = Field(default=10, ge=3, le=40)


class StudyProgressUpdate(BaseModel):
    status: str | None = Field(default=None, max_length=40)
    marked_difficult: bool | None = None
    correct: bool | None = None


SUMMARY_MODES = {
    "short": "Create a 5-10 line quick overview with only the most important ideas.",
    "detailed": "Create a comprehensive structured summary that preserves hierarchy and explanations.",
    "exam": "Create an exam-focused summary: high-weight topics, definitions, formulas, likely questions, and common traps.",
    "bullets": "Create concise point-wise revision notes with headings and crisp bullets.",
    "simple": "Explain the material in beginner-friendly language with simple examples.",
}

REVISION_MODES = {
    "night-before": "Ultra concise high-yield last-minute notes only.",
    "formula": "Extract formulas, definitions, theorems, conditions, and when to use them.",
    "interview": "Create interview prep notes with direct Q&A and practical examples.",
    "important-questions": "Generate likely exam questions grouped by topic.",
    "topic-wise": "Create topic-wise revision sheets with key facts and memory hooks.",
}


def _parse_ids(value: str | None) -> list[int]:
    try:
        return [int(item) for item in json.loads(value or "[]")]
    except (TypeError, ValueError, json.JSONDecodeError):
        return []


def _owned_documents(db: Session, user_id: int, document_ids: list[int]) -> list[Document]:
    unique_ids = sorted({int(document_id) for document_id in document_ids})
    if not unique_ids:
        return []
    documents = db.query(Document).filter(Document.user_id == user_id, Document.id.in_(unique_ids)).all()
    found = {document.id for document in documents}
    if set(unique_ids) - found:
        raise HTTPException(status_code=404, detail="One or more documents were not found")
    return documents


def _owned_groups(db: Session, user_id: int, group_ids: list[int]) -> list[DocumentGroup]:
    unique_ids = sorted({int(group_id) for group_id in group_ids})
    if not unique_ids:
        return []
    groups = db.query(DocumentGroup).filter(DocumentGroup.user_id == user_id, DocumentGroup.id.in_(unique_ids)).all()
    found = {group.id for group in groups}
    if set(unique_ids) - found:
        raise HTTPException(status_code=404, detail="One or more workspaces were not found")
    return groups


def _resolve_scope(db: Session, user_id: int, body: StudyGenerateRequest) -> tuple[list[Document], list[DocumentGroup]]:
    documents_by_id = {document.id: document for document in _owned_documents(db, user_id, body.document_ids)}
    groups = _owned_groups(db, user_id, body.group_ids)
    for group in groups:
        for document in group.documents:
            documents_by_id[document.id] = document

    documents = [
        document
        for document in documents_by_id.values()
        if document.status == "indexed" and document.chunk_count > 0
    ]
    if not documents:
        raise HTTPException(status_code=400, detail="Select at least one indexed document or workspace")
    return documents, groups


def _source_query(body: StudyGenerateRequest, documents: list[Document], groups: list[DocumentGroup]) -> str:
    target = body.query.strip()
    if target:
        return target
    group_names = ", ".join(group.name for group in groups[:3])
    doc_names = ", ".join(document.filename for document in documents[:3])
    if body.tool == "flashcards":
        return f"exam relevant definitions concepts formulas active recall {group_names} {doc_names}"
    if body.tool == "mcq":
        return f"important concepts definitions formulas application questions {group_names} {doc_names}"
    if body.tool == "revision":
        return f"high yield revision formulas definitions likely questions {group_names} {doc_names}"
    return f"key concepts hierarchy definitions formulas summary {group_names} {doc_names}"


def _prompt_for(body: StudyGenerateRequest, sources: list[dict]) -> tuple[str, str]:
    source_list = "\n".join(
        f"[{source['label']}] {source.get('filename') or 'note'}"
        f"{' / ' + source.get('section_heading') if source.get('section_heading') else ''}"
        f"\n{source['content']}"
        for source in sources
    )
    grounding = (
        "Use only the source context for factual claims. If evidence is missing, say so in the JSON notes. "
        "Keep every item exam-relevant, non-duplicative, and grounded in the cited source labels."
    )

    if body.tool == "summary":
        mode_instruction = SUMMARY_MODES.get(body.mode, SUMMARY_MODES["exam"])
        schema = (
            '{"title": str, "mode": str, "sections": [{"heading": str, "bullets": [str], '
            '"source_labels": [str]}], "definitions": [{"term": str, "definition": str, "source_labels": [str]}], '
            '"likely_questions": [str], "notes": [str]}'
        )
        task = f"{mode_instruction} Detect headings, repeated concepts, formulas, definitions, and likely exam areas."
    elif body.tool == "flashcards":
        schema = (
            '{"title": str, "cards": [{"id": str, "type": "qa|term|formula|concept|true_false", '
            '"front": str, "back": str, "topic": str, "source_labels": [str], "difficulty": str}], "notes": [str]}'
        )
        task = f"Generate {body.count} concise active-recall flashcards. Avoid duplicates and long answers."
    elif body.tool == "mcq":
        schema = (
            '{"title": str, "questions": [{"id": str, "type": "conceptual|factual|application|assertion_reason|true_false|fill_blank", '
            '"question": str, "options": [str, str, str, str], "correct_answer": str, '
            '"explanation": str, "topic": str, "source_labels": [str], "difficulty": str}], "notes": [str]}'
        )
        task = f"Generate {body.count} {body.difficulty} exam-style MCQs with four distinct options and clear explanations."
    else:
        mode_instruction = REVISION_MODES.get(body.mode, REVISION_MODES["topic-wise"])
        schema = (
            '{"title": str, "mode": str, "high_yield": [str], "formula_sheet": [str], '
            '"concept_map": [{"topic": str, "links": [str]}], "important_questions": [str], '
            '"revision_order": [str], "notes": [str]}'
        )
        task = f"{mode_instruction} Prioritize high-yield topics and efficient exam preparation."

    system = (
        "You are DronaAI's exam preparation engine. Produce strict JSON only, with no markdown fences. "
        f"{grounding} Required schema: {schema}"
    )
    human = f"Task: {task}\n\nStudent focus: {body.query or 'General exam preparation'}\n\nSource context:\n{source_list}"
    return system, human


def _parse_json_response(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.S)
        if not match:
            raise HTTPException(status_code=500, detail="AI returned an invalid study material format")
        return json.loads(match.group(0))


def _material_payload(material: StudyMaterial, include_content: bool = True) -> dict[str, Any]:
    content = json.loads(material.content_json or "{}") if include_content else None
    progress = {
        item.item_id: {
            "status": item.status,
            "marked_difficult": item.marked_difficult,
            "correct_count": item.correct_count,
            "wrong_count": item.wrong_count,
            "last_reviewed_at": item.last_reviewed_at,
        }
        for item in material.progress
    }
    payload = {
        "id": material.id,
        "material_type": material.material_type,
        "mode": material.mode,
        "difficulty": material.difficulty,
        "title": material.title,
        "query": material.query,
        "source_document_ids": _parse_ids(material.source_document_ids),
        "source_group_ids": _parse_ids(material.source_group_ids),
        "confidence": float(material.confidence or 0),
        "progress": progress,
        "created_at": material.created_at,
        "updated_at": material.updated_at,
    }
    if include_content:
        payload["content"] = content
    return payload


def _markdown_export(material: StudyMaterial) -> str:
    content = json.loads(material.content_json or "{}")
    lines = [f"# {material.title}", "", f"Type: {material.material_type}", f"Mode: {material.mode}", ""]
    if material.material_type == "summary":
        for section in content.get("sections", []):
            lines.extend([f"## {section.get('heading', 'Section')}"])
            lines.extend(f"- {item}" for item in section.get("bullets", []))
            lines.append("")
        if content.get("definitions"):
            lines.append("## Definitions")
            lines.extend(f"- **{item.get('term')}**: {item.get('definition')}" for item in content["definitions"])
    elif material.material_type == "flashcards":
        for index, card in enumerate(content.get("cards", []), start=1):
            lines.extend([f"## Card {index}", f"Q: {card.get('front')}", f"A: {card.get('back')}", ""])
    elif material.material_type == "mcq":
        for index, question in enumerate(content.get("questions", []), start=1):
            lines.extend([f"## Question {index}", question.get("question", "")])
            lines.extend(f"- {option}" for option in question.get("options", []))
            lines.extend([f"Answer: {question.get('correct_answer')}", f"Explanation: {question.get('explanation')}", ""])
    else:
        for key in ["high_yield", "formula_sheet", "important_questions", "revision_order"]:
            if content.get(key):
                lines.extend([f"## {key.replace('_', ' ').title()}"])
                lines.extend(f"- {item}" for item in content[key])
                lines.append("")
    return "\n".join(lines).strip() + "\n"


@router.get("/materials", response_model=Any)
def list_materials(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    materials = (
        db.query(StudyMaterial)
        .filter(StudyMaterial.user_id == current_user.id)
        .order_by(StudyMaterial.updated_at.desc())
        .limit(60)
        .all()
    )
    return [_material_payload(material, include_content=False) for material in materials]


@router.get("/materials/{material_id}", response_model=Any)
def get_material(material_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    material = db.query(StudyMaterial).filter(StudyMaterial.id == material_id, StudyMaterial.user_id == current_user.id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Study material not found")
    return _material_payload(material)


@router.post("/generate", response_model=Any)
async def generate_material(
    body: StudyGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(status_code=500, detail="Groq API key not configured.")

    documents, groups = _resolve_scope(db, current_user.id, body)
    query = _source_query(body, documents, groups)
    top_k = 10 if body.tool in {"summary", "revision"} else min(14, max(8, body.count))
    sources = retrieve_context(query, current_user.id, [document.id for document in documents], top_k=top_k, min_confidence=0.36)
    if not sources:
        raise HTTPException(status_code=422, detail="Could not retrieve enough grounded context from the selected scope")

    system, human = _prompt_for(body, sources)
    llm = ChatGroq(temperature=0.2, model_name="llama-3.1-8b-instant", groq_api_key=groq_api_key)
    response = await llm.ainvoke([SystemMessage(content=system), HumanMessage(content=human)])
    content = _parse_json_response(response.content or "{}")
    title = str(content.get("title") or f"{body.tool.title()} - {query[:48]}").strip()[:120]
    confidence = round(sum(source.get("confidence", 0) for source in sources) / len(sources), 3)

    material = StudyMaterial(
        user_id=current_user.id,
        material_type=body.tool,
        mode=body.mode,
        difficulty=body.difficulty.lower(),
        title=title,
        query=body.query.strip(),
        content_json=json.dumps({**content, "sources": sources}),
        source_document_ids=json.dumps([document.id for document in documents]),
        source_group_ids=json.dumps([group.id for group in groups]),
        confidence=str(confidence),
    )
    try:
        db.add(material)
        db.commit()
        db.refresh(material)
    except Exception:
        db.rollback()
        raise
    return _material_payload(material)


@router.patch("/materials/{material_id}/progress/{item_id}", response_model=Any)
def update_progress(
    material_id: int,
    item_id: str,
    body: StudyProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    material = db.query(StudyMaterial).filter(StudyMaterial.id == material_id, StudyMaterial.user_id == current_user.id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Study material not found")

    progress = (
        db.query(StudyProgress)
        .filter(StudyProgress.material_id == material.id, StudyProgress.user_id == current_user.id, StudyProgress.item_id == item_id)
        .first()
    )
    if not progress:
        progress = StudyProgress(user_id=current_user.id, material_id=material.id, item_id=item_id)
        db.add(progress)

    if body.status is not None:
        progress.status = body.status
    if body.marked_difficult is not None:
        progress.marked_difficult = body.marked_difficult
    if body.correct is True:
        progress.correct_count += 1
    if body.correct is False:
        progress.wrong_count += 1
    progress.last_reviewed_at = func.now()
    db.commit()
    db.refresh(material)
    return _material_payload(material)


@router.get("/materials/{material_id}/export")
def export_material(material_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    material = db.query(StudyMaterial).filter(StudyMaterial.id == material_id, StudyMaterial.user_id == current_user.id).first()
    if not material:
        raise HTTPException(status_code=404, detail="Study material not found")
    filename = re.sub(r"[^a-zA-Z0-9_-]+", "-", material.title.lower()).strip("-") or "study-material"
    return PlainTextResponse(
        _markdown_export(material),
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="{filename}.md"'},
    )
