import os
import asyncio
import re
import uuid
from datetime import datetime, timezone
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

VECTORSTORE_ROOT = os.path.join(os.path.dirname(__file__), "vectorstore")
os.makedirs(VECTORSTORE_ROOT, exist_ok=True)

_embeddings = None


def get_embeddings():
    """Lazily load embeddings so the API can boot even before model cache exists."""
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    return _embeddings

# Markdown-aware separators for better semantic chunking
CHUNK_SEPARATORS = [
    "\n## ",      # H2 headers
    "\n### ",     # H3 headers  
    "\n#### ",    # H4 headers
    "\n\n",       # Paragraph breaks
    "\n- ",       # List items
    "\n* ",       # List items (alt)
    "\n",         # Line breaks
    ". ",         # Sentences
    " ",          # Words
    "",           # Characters (fallback)
]


def _namespace_for_user(user_id: int) -> str:
    return f"user_{user_id}"


def _vectorstore_path(user_id: int) -> str:
    path = os.path.join(VECTORSTORE_ROOT, _namespace_for_user(user_id), "faiss_index")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def _load_and_chunk(
    file_path: str,
    document_id: int,
    user_id: int,
    filename: str,
    session_id: int | None = None,
    group_id: int | None = None,
):
    """Load a document and split into semantically-aware chunks."""
    lower_path = file_path.lower()
    if lower_path.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
    elif lower_path.endswith(".txt"):
        loader = TextLoader(file_path)
    else:
        raise ValueError("Unsupported file type")

    docs = loader.load()

    # Enrich metadata
    upload_timestamp = datetime.now(timezone.utc).isoformat()
    for i, doc in enumerate(docs):
        doc.metadata["user_id"] = user_id
        doc.metadata["document_id"] = document_id
        doc.metadata["session_id"] = session_id
        doc.metadata["group_id"] = group_id
        doc.metadata["filename"] = filename
        doc.metadata["upload_timestamp"] = upload_timestamp
        doc.metadata["chunk_index"] = i
        # Preserve source info
        if "page" in doc.metadata:
            doc.metadata["page_number"] = doc.metadata["page"] + 1  # 1-indexed
        # Try to extract section heading from content
        lines = doc.page_content.strip().split("\n")
        if lines:
            first_line = lines[0].strip()
            if len(first_line) < 100 and first_line:
                doc.metadata["section_heading"] = first_line

    # Semantic chunking with larger chunks and more overlap
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=300,
        length_function=len,
        separators=CHUNK_SEPARATORS,
        keep_separator=True,
    )
    chunks = text_splitter.split_documents(docs)

    # Propagate metadata to chunks
    for i, chunk in enumerate(chunks):
        chunk_id = f"doc{document_id}_chunk{i}_{uuid.uuid4().hex}"
        chunk.metadata["user_id"] = user_id
        chunk.metadata["chunk_index"] = i
        chunk.metadata["chunk_id"] = chunk_id
        chunk.metadata["embedding_id"] = chunk_id
        chunk.metadata["total_chunks"] = len(chunks)
        chunk.metadata["document_id"] = document_id
        chunk.metadata["session_id"] = session_id
        chunk.metadata["group_id"] = group_id
        chunk.metadata["filename"] = filename
        chunk.metadata["upload_timestamp"] = upload_timestamp

    return chunks


def process_and_store_document(
    file_path: str,
    document_id: int,
    user_id: int,
    filename: str,
    session_id: int | None = None,
    group_id: int | None = None,
):
    """Process a document and store in FAISS vectorstore. Synchronous."""
    chunks = _load_and_chunk(file_path, document_id, user_id, filename, session_id, group_id)
    vectorstore_path = _vectorstore_path(user_id)

    if os.path.exists(vectorstore_path):
        vectorstore = FAISS.load_local(
            vectorstore_path, get_embeddings(), allow_dangerous_deserialization=True
        )
        vectorstore.add_documents(chunks, ids=[chunk.metadata["embedding_id"] for chunk in chunks])
    else:
        vectorstore = FAISS.from_documents(
            chunks,
            get_embeddings(),
            ids=[chunk.metadata["embedding_id"] for chunk in chunks],
        )

    vectorstore.save_local(vectorstore_path)

    return [
        {
            "chunk_text": chunk.page_content,
            "embedding_id": chunk.metadata["embedding_id"],
            "metadata": chunk.metadata,
        }
        for chunk in chunks
    ]


async def process_and_store_document_async(
    file_path: str,
    document_id: int,
    user_id: int,
    filename: str,
    session_id: int | None = None,
    group_id: int | None = None,
):
    """Async wrapper that runs the blocking FAISS operations in a thread pool."""
    return await asyncio.to_thread(
        process_and_store_document,
        file_path,
        document_id,
        user_id,
        filename,
        session_id,
        group_id,
    )


def _load_vectorstore(user_id: int):
    vectorstore_path = _vectorstore_path(user_id)
    if not os.path.exists(vectorstore_path):
        return None
    try:
        return FAISS.load_local(
            vectorstore_path, get_embeddings(), allow_dangerous_deserialization=True
        )
    except Exception as e:
        print(f"Error loading vectorstore: {e}")
        return None


def _keywords(text: str) -> set[str]:
    return {
        word
        for word in re.findall(r"[a-zA-Z][a-zA-Z0-9_-]{2,}", text.lower())
        if word
        not in {
            "the",
            "and",
            "for",
            "with",
            "that",
            "this",
            "from",
            "what",
            "how",
            "why",
            "are",
            "was",
            "were",
            "you",
            "your",
        }
    }


def retrieve_context(
    query: str,
    user_id: int,
    document_ids: list[int] | None = None,
    top_k: int = 6,
    min_confidence: float = 0.46,
):
    """Return reranked chunks with metadata and confidence scores.

    FAISS provides fast semantic recall. We add a lightweight lexical rerank so
    headings, exact terms, formulas, and definitions are promoted when present.
    """
    allowed_document_ids = set(document_ids or [])
    if not allowed_document_ids:
        return []

    vectorstore = _load_vectorstore(user_id)
    if not vectorstore:
        return []

    try:
        raw_results = vectorstore.similarity_search_with_score(query, k=max(top_k * 8, 32))
    except Exception as e:
        print(f"Error retrieving context: {e}")
        return []

    query_terms = _keywords(query)
    reranked = []
    for doc, distance in raw_results:
        metadata = doc.metadata or {}
        if metadata.get("user_id") != user_id:
            continue
        if metadata.get("document_id") not in allowed_document_ids:
            continue
        text_terms = _keywords(doc.page_content)
        lexical_overlap = len(query_terms & text_terms) / max(len(query_terms), 1)
        semantic_score = 1 / (1 + max(float(distance), 0.0))
        confidence = min(0.98, (semantic_score * 0.72) + (lexical_overlap * 0.28))
        if confidence < min_confidence:
            continue
        reranked.append((confidence, doc, distance))

    reranked.sort(key=lambda item: item[0], reverse=True)

    results = []
    for index, (confidence, doc, _distance) in enumerate(reranked[:top_k], start=1):
        metadata = doc.metadata or {}
        snippet = " ".join(doc.page_content.split())
        results.append(
            {
                "label": f"S{index}",
                "content": doc.page_content,
                "snippet": snippet[:420],
                "confidence": round(confidence, 3),
                "relevance": _relevance_label(confidence),
                "document_id": metadata.get("document_id"),
                "filename": metadata.get("filename"),
                "chunk_id": metadata.get("chunk_id"),
                "embedding_id": metadata.get("embedding_id"),
                "chunk_index": metadata.get("chunk_index"),
                "page_number": metadata.get("page_number") or metadata.get("page"),
                "section_heading": metadata.get("section_heading"),
                "source": metadata.get("source"),
            }
        )

    return results


def _relevance_label(confidence: float) -> str:
    if confidence >= 0.72:
        return "high"
    if confidence >= 0.55:
        return "medium"
    return "low"


def delete_document_from_vectorstore(document_id: int, user_id: int):
    """Delete all chunks belonging to a document from the vectorstore."""
    vectorstore_path = _vectorstore_path(user_id)
    if os.path.exists(vectorstore_path):
        try:
            vectorstore = FAISS.load_local(
                vectorstore_path, get_embeddings(), allow_dangerous_deserialization=True
            )
            ids_to_delete = []
            for doc_id, doc in vectorstore.docstore._dict.items():
                if doc.metadata.get("user_id") == user_id and doc.metadata.get("document_id") == document_id:
                    ids_to_delete.append(doc_id)
            if ids_to_delete:
                vectorstore.delete(ids_to_delete)
                vectorstore.save_local(vectorstore_path)
        except Exception as e:
            print(f"Error deleting from vectorstore: {e}")
