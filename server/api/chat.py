import os
import json
import re
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

from api.deps import get_current_user
from models.user import User
from models.chat import ChatSession, ChatMessage, RetrievalMetadata
from models.document import Document
from db.session import get_db, SessionLocal
from rag.pipeline import retrieve_context

router = APIRouter()


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=12000)
    session_id: int | None = None
    document_id: int | None = None
    document_ids: list[int] | None = None


SYSTEM_PROMPT = (
    "You are **DronaAI**, a world-class AI study assistant designed to help students deeply understand their course materials.\n\n"
    "## Your Core Principles\n"
    "1. **Context-Aware**: Use uploaded document context only when it is provided and relevant to this turn.\n"
    "2. **Supplement Intelligently**: If only partial information exists in the documents, combine it with "
    "your general knowledge. Clearly distinguish between the two:\n"
    '   - "Based on your notes: ..."\n'
    '   - "Additionally, from my knowledge: ..."\n'
    "3. **General Help Is Allowed**: If no source context is provided, answer naturally using general knowledge without mentioning citations.\n"
    "4. **Be Educational**: Explain concepts with clarity, use analogies, break down complex ideas step-by-step.\n\n"
    "## Formatting Rules\n"
    "- Use **markdown** extensively: headings, bullet points, numbered lists, bold key terms\n"
    "- Use `code blocks` for any code, formulas, or technical syntax\n"
    "- Keep paragraphs concise (2-3 sentences max)\n"
    "- Use tables when comparing concepts\n"
    "- End complex explanations with a brief **Key Takeaway** summary\n\n"
    "## Conversation Awareness\n"
    "- You have access to the conversation history below. Reference previous messages naturally.\n"
    "- If the student asks a follow-up, connect it to what was discussed before.\n"
    "- Maintain a warm, encouraging, patient tone throughout.\n\n"
    "## Citation Rules\n"
    "- When source context is provided and you rely on it, cite source labels inline like [S1] or [S2].\n"
    "- Do not fabricate citations. Only cite labels that appear in the provided source context.\n"
    "- Never invent document names, document numbers, paper titles, pages, or summaries that are not in the source context.\n"
    "- If no source context is provided, do not cite, do not mention source cards, and do not claim that uploaded notes said anything.\n\n"
    "## Active Retrieval Scope\n"
    "{retrieval_scope}\n\n"
    "## Source Context\n"
    "{context}\n\n"
    "## Retrieval Confidence\n"
    "{confidence_note}"
)

# Maximum number of previous messages to include for context
MAX_HISTORY_MESSAGES = 20
# Approximate max characters of history to include (to manage tokens)
MAX_HISTORY_CHARS = 6000
RETRIEVAL_MIN_CONFIDENCE = 0.46
EXPLICIT_RETRIEVAL_MIN_CONFIDENCE = 0.38

GREETING_RE = re.compile(r"^\s*(hi|hello|hey|yo|sup|good\s+(morning|afternoon|evening))[\s!.,?]*$", re.I)
CASUAL_RE = re.compile(
    r"^\s*(thanks|thank you|ok|okay|cool|great|nice|lol|haha|how are you|what'?s up)[\s!.,?]*$",
    re.I,
)
DOC_REQUEST_RE = re.compile(
    r"\b(my notes|uploaded|upload|pdf|document|documents|doc|docs|file|files|source|sources|citation|citations|according to|based on|from (the )?(notes|pdf|document|file))\b",
    re.I,
)
SUMMARY_RE = re.compile(r"\b(summarize|summary|recap|outline|key points|main ideas|revise|revision)\b", re.I)
COMPARISON_RE = re.compile(r"\b(compare|contrast|difference|differences|versus| vs )\b", re.I)


def _build_chat_history(db: Session, session_id: int) -> list:
    """Load recent messages from DB and convert to LangChain message objects."""
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    # Take the last N messages
    recent = messages[-MAX_HISTORY_MESSAGES:] if len(messages) > MAX_HISTORY_MESSAGES else messages

    # Trim by character budget
    history = []
    total_chars = 0
    for msg in reversed(recent):
        total_chars += len(msg.content)
        if total_chars > MAX_HISTORY_CHARS:
            break
        if msg.role == "user":
            history.insert(0, HumanMessage(content=msg.content))
        else:
            history.insert(0, AIMessage(content=msg.content))

    return history


def _format_context(sources: list[dict]) -> tuple[str, str]:
    if not sources:
        return (
            "No uploaded document context was retrieved for this turn.",
            "No document context is available. Help using general knowledge and be explicit about that.",
        )

    parts = []
    confidences = []
    for source in sources:
        location_bits = []
        if source.get("page_number") is not None:
            location_bits.append(f"page {source['page_number']}")
        if source.get("section_heading"):
            location_bits.append(f"section: {source['section_heading']}")
        if source.get("filename"):
            location_bits.insert(0, f"file: {source['filename']}")
        location = f" ({', '.join(location_bits)})" if location_bits else ""
        parts.append(f"[{source['label']}]{location}\n{source['content']}")
        confidences.append(source["confidence"])

    avg_confidence = sum(confidences) / len(confidences)
    if avg_confidence >= 0.72:
        note = "Retrieved context appears strong. Prioritize it."
    elif avg_confidence >= 0.45:
        note = "Retrieved context appears partial. Blend notes with general knowledge and label each clearly."
    else:
        note = "Retrieved context appears weak. Mention that the notes may not cover the question well."

    return "\n\n---\n\n".join(parts), note


def _source_payload(sources: list[dict]) -> list[dict]:
    return [
        {
            "label": s["label"],
            "document_id": s.get("document_id"),
            "filename": s.get("filename"),
            "page_number": s.get("page_number"),
            "section_heading": s.get("section_heading"),
            "confidence": s.get("confidence"),
            "relevance": s.get("relevance"),
            "snippet": s.get("snippet"),
        }
        for s in sources
    ]


def _classify_query(message: str, has_explicit_documents: bool) -> str:
    normalized = message.strip()
    if GREETING_RE.match(normalized):
        return "greeting"
    if CASUAL_RE.match(normalized):
        return "conversational"
    if "@" in normalized or has_explicit_documents:
        if COMPARISON_RE.search(normalized):
            return "comparison"
        if SUMMARY_RE.search(normalized):
            return "document-summary"
        return "workspace-specific"
    if "cite" in normalized.lower() or "citation" in normalized.lower():
        return "citation-required"
    if DOC_REQUEST_RE.search(normalized):
        if COMPARISON_RE.search(normalized):
            return "comparison"
        if SUMMARY_RE.search(normalized):
            return "document-summary"
        return "retrieval-required"
    return "general knowledge"


def _retrieval_forbidden(intent: str) -> bool:
    return intent in {"greeting", "conversational"}


def _candidate_documents(
    db: Session,
    user_id: int,
    requested_documents: list[Document],
    session: ChatSession,
) -> tuple[list[Document], str]:
    if requested_documents:
        return requested_documents, "explicit"

    session_ids = _session_document_ids(session)
    if session_ids:
        return _validate_documents(db, user_id, session_ids), "session"

    documents = (
        db.query(Document)
        .filter(Document.user_id == user_id, Document.status == "indexed", Document.chunk_count > 0)
        .order_by(Document.updated_at.desc())
        .all()
    )
    return documents, "semantic"


def _generate_title(message: str) -> str:
    """Generate a clean session title from the first message."""
    # Clean up and truncate
    title = message.strip().replace("\n", " ")
    if len(title) > 60:
        # Try to break at a word boundary
        truncated = title[:57]
        last_space = truncated.rfind(" ")
        if last_space > 30:
            title = truncated[:last_space] + "..."
        else:
            title = truncated + "..."
    return title


def _parse_document_ids(value: str | None) -> list[int]:
    try:
        parsed = json.loads(value or "[]")
        return [int(item) for item in parsed if item is not None]
    except (TypeError, ValueError, json.JSONDecodeError):
        return []


def _requested_document_ids(request: ChatRequest) -> list[int]:
    ids = list(request.document_ids or [])
    if request.document_id:
        ids.append(request.document_id)
    return sorted({int(document_id) for document_id in ids})


def _validate_documents(db: Session, user_id: int, document_ids: list[int]) -> list[Document]:
    if not document_ids:
        return []
    documents = (
        db.query(Document)
        .filter(Document.user_id == user_id, Document.id.in_(document_ids))
        .all()
    )
    found_ids = {document.id for document in documents}
    if set(document_ids) - found_ids:
        raise HTTPException(status_code=404, detail="One or more active documents were not found")
    return documents


def _set_session_documents(session: ChatSession, documents: list[Document]):
    session.documents = documents
    ids = [document.id for document in documents]
    session.active_document_ids = json.dumps(ids)
    session.document_id = ids[0] if ids else None


def _session_document_ids(session: ChatSession) -> list[int]:
    ids = _parse_document_ids(session.active_document_ids)
    if ids:
        return ids
    if session.document_id:
        return [session.document_id]
    return [document.id for document in session.documents]


def _retrieval_scope(documents: list[Document]) -> str:
    if not documents:
        return "No uploaded documents are attached to this chat. Use general knowledge and say no note context was available."
    lines = [
        "Only these uploaded documents are allowed for retrieval in this chat:"
    ]
    for document in documents:
        lines.append(
            f"- document_id={document.id}, filename={document.filename}, status={document.status}, chunks={document.chunk_count}"
        )
    return "\n".join(lines)


@router.post("/")
async def chat_with_docs(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(status_code=500, detail="Groq API key not configured.")

    # Resolve or create session
    session = None
    requested_ids = _requested_document_ids(request)
    requested_documents = _validate_documents(db, current_user.id, requested_ids)

    if request.session_id:
        session = (
            db.query(ChatSession)
            .filter(
                ChatSession.id == request.session_id,
                ChatSession.user_id == current_user.id,
            )
            .first()
        )

    if not session:
        title = _generate_title(request.message)
        session = ChatSession(
            user_id=current_user.id,
            title=title,
        )
        if requested_documents:
            _set_session_documents(session, requested_documents)
        db.add(session)
        db.commit()
        db.refresh(session)
    elif requested_ids:
        _set_session_documents(session, requested_documents)
        db.commit()
        db.refresh(session)

    # Persist user message
    user_msg = ChatMessage(
        session_id=session.id, role="user", content=request.message
    )
    db.add(user_msg)
    db.commit()

    # Build conversation history from DB (BEFORE the current message, which we just added)
    chat_history = _build_chat_history(db, session.id)
    # Remove the last message (the one we just added) since it will be the current input
    if chat_history and isinstance(chat_history[-1], HumanMessage):
        chat_history = chat_history[:-1]

    # Capture session ID for the generator (avoid referencing db-bound objects in generator)
    session_id = session.id
    intent = _classify_query(request.message, has_explicit_documents=bool(requested_ids))
    candidate_documents, retrieval_scope_type = _candidate_documents(
        db,
        current_user.id,
        requested_documents,
        session,
    )
    candidate_documents = [
        document
        for document in candidate_documents
        if document.status == "indexed" and document.chunk_count > 0
    ]
    candidate_document_ids = [document.id for document in candidate_documents]
    active_document_ids = [
        document.id
        for document in _validate_documents(db, current_user.id, _session_document_ids(session))
        if document.status == "indexed"
    ]
    retrieval_scope = _retrieval_scope(candidate_documents)

    sources = []
    if candidate_document_ids and not _retrieval_forbidden(intent):
        min_confidence = (
            EXPLICIT_RETRIEVAL_MIN_CONFIDENCE
            if retrieval_scope_type in {"explicit", "session"}
            or intent in {"retrieval-required", "document-summary", "comparison", "workspace-specific", "citation-required"}
            else RETRIEVAL_MIN_CONFIDENCE
        )
        sources = retrieve_context(
            request.message,
            user_id=current_user.id,
            document_ids=candidate_document_ids,
            top_k=5,
            min_confidence=min_confidence,
        )

    context, confidence_note = _format_context(sources)

    llm = ChatGroq(
        temperature=0.25,
        model_name="llama-3.1-8b-instant",
        groq_api_key=groq_api_key,
    )

    system_message = SYSTEM_PROMPT.format(
        context=context,
        confidence_note=confidence_note,
        retrieval_scope=retrieval_scope,
    )
    prompt_messages = [
        SystemMessage(content=system_message),
        *chat_history,
        HumanMessage(content=request.message),
    ]

    async def generate():
        full_response = ""

        # Send session metadata first
        yield f"data: {json.dumps({'session_id': session_id, 'type': 'meta', 'sources': [], 'active_document_ids': active_document_ids, 'intent': intent, 'retrieval_used': False})}\n\n"

        try:
            async for chunk in llm.astream(prompt_messages):
                text = chunk.content or ""
                if text:
                    full_response += text
                    yield f"data: {json.dumps({'text': text})}\n\n"
        except Exception as e:
            print(f"Chat generation error: {e}")
            error_msg = "I encountered an error generating a response. Please try again."
            yield f"data: {json.dumps({'text': error_msg})}\n\n"
            full_response = error_msg

        used_sources = [
            source
            for source in sources
            if re.search(rf"\[{re.escape(source['label'])}\]", full_response)
        ]
        if used_sources:
            yield f"data: {json.dumps({'type': 'meta', 'sources': _source_payload(used_sources), 'retrieval_used': True})}\n\n"

        # Persist assistant response using a NEW db session to avoid lifecycle issues
        try:
            write_db = SessionLocal()
            assistant_msg = ChatMessage(
                session_id=session_id, role="assistant", content=full_response
            )
            write_db.add(assistant_msg)
            write_db.flush()
            for source in used_sources:
                write_db.add(
                    RetrievalMetadata(
                        session_id=session_id,
                        message_id=assistant_msg.id,
                        document_id=source.get("document_id"),
                        source_label=source["label"],
                        chunk_index=source.get("chunk_index"),
                        page_number=source.get("page_number"),
                        section_heading=source.get("section_heading"),
                        confidence=source.get("confidence") or 0.0,
                        snippet=source.get("snippet") or "",
                    )
                )
            # Update session updated_at
            s = write_db.query(ChatSession).filter(ChatSession.id == session_id).first()
            if s:
                from sqlalchemy.sql import func
                s.updated_at = func.now()
            write_db.commit()
            write_db.close()
        except Exception as e:
            print(f"Error persisting assistant message: {e}")

        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
