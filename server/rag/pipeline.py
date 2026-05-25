import os
import asyncio
import re
import uuid
import pickle
import math
from collections import Counter, defaultdict
from datetime import datetime, timezone
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

VECTORSTORE_ROOT = os.path.join(os.path.dirname(__file__), "vectorstore")
os.makedirs(VECTORSTORE_ROOT, exist_ok=True)

EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDING_VERSION = f"huggingface:{EMBEDDING_MODEL_NAME}:v1"

_embeddings = None


def get_embeddings():
    """Lazily load embeddings so the API can boot even before model cache exists."""
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL_NAME)
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

STOPWORDS = {
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
    "about",
    "into",
    "tell",
    "give",
    "using",
    "based",
    "notes",
    "document",
    "documents",
}

INTENT_EXPANSIONS = {
    "summarize": ["summary", "key points", "main ideas", "outline", "takeaways"],
    "compare": ["similarities", "differences", "contrast", "versus", "relationship"],
    "transformer": ["attention mechanism", "self attention", "encoder decoder", "sequence model"],
    "attention": ["query key value", "self attention", "multi head attention"],
    "resume": ["skills", "experience", "projects", "education", "achievements"],
    "research": ["methodology", "results", "abstract", "conclusion", "limitations"],
}


def _namespace_for_user(user_id: int) -> str:
    return f"user_{user_id}"


def _vectorstore_path(user_id: int) -> str:
    path = os.path.join(VECTORSTORE_ROOT, _namespace_for_user(user_id), "faiss_index")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def _keywords(text: str, limit: int | None = None) -> list[str]:
    words = [
        word
        for word in re.findall(r"[a-zA-Z][a-zA-Z0-9_-]{2,}", text.lower())
        if word not in STOPWORDS
    ]
    ranked = [word for word, _ in Counter(words).most_common(limit)]
    return ranked if limit else words


def _extract_section_title(text: str, fallback: str | None = None) -> str | None:
    for raw_line in text.splitlines()[:12]:
        line = raw_line.strip().strip("#").strip()
        if not line:
            continue
        if len(line) <= 120 and not line.endswith("."):
            return line
    return fallback


def _detect_chunk_type(text: str) -> str:
    stripped = text.strip()
    if re.search(r"```|^\s{4}\w+", stripped, re.M):
        return "code"
    if re.search(r"^\s*[-*]\s+|^\s*\d+[.)]\s+", stripped, re.M):
        return "list"
    if re.search(r"\|.+\|", stripped):
        return "table"
    if re.search(r"\b(theorem|lemma|proof|equation|formula)\b|[=∑∫√≤≥]", stripped, re.I):
        return "equation"
    if len(stripped) < 420:
        return "definition"
    return "section"


def _detect_document_type(filename: str, text: str) -> str:
    sample = f"{filename}\n{text[:5000]}".lower()
    if "resume" in sample or "curriculum vitae" in sample or re.search(r"\bexperience\b.*\bskills\b", sample, re.S):
        return "resume"
    if "abstract" in sample and ("methodology" in sample or "references" in sample):
        return "research_paper"
    if "syllabus" in sample or "course outcomes" in sample:
        return "syllabus"
    if "assignment" in sample or "submission" in sample:
        return "assignment"
    if re.search(r"\bdef\s+\w+\(|class\s+\w+|import\s+\w+|function\s+\w+", sample):
        return "code_document"
    if "chapter" in sample and ("exercise" in sample or "review questions" in sample):
        return "textbook"
    return "notes"


def _topic_from_keywords(keywords: list[str]) -> str | None:
    return ", ".join(keywords[:4]) if keywords else None


def _expanded_queries(query: str, max_queries: int = 5) -> list[str]:
    terms = set(_keywords(query))
    expansions = [query]
    for term in terms:
        for extra in INTENT_EXPANSIONS.get(term, []):
            expansions.append(f"{query} {extra}")
    if any(word in terms for word in {"explain", "concept", "simple"}):
        expansions.append(f"{query} definition example intuition")
    if any(word in terms for word in {"mcq", "quiz", "flashcard", "revise", "revision"}):
        expansions.append(f"{query} key facts definitions examples")

    deduped = []
    seen = set()
    for item in expansions:
        normalized = item.lower()
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(item)
        if len(deduped) >= max_queries:
            break
    return deduped


def _metadata_filter(metadata: dict, user_id: int, allowed_document_ids: set[int]) -> bool:
    if metadata.get("user_id") != user_id:
        return False
    try:
        document_id = int(metadata.get("document_id"))
    except (TypeError, ValueError):
        return False
    return document_id in allowed_document_ids


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
    document_text = "\n\n".join(doc.page_content for doc in docs)
    document_type = _detect_document_type(filename, document_text)

    # Enrich metadata
    upload_timestamp = datetime.now(timezone.utc).isoformat()
    for i, doc in enumerate(docs):
        doc.metadata["user_id"] = user_id
        doc.metadata["document_id"] = document_id
        doc.metadata["session_id"] = session_id
        doc.metadata["group_id"] = group_id
        doc.metadata["group_ids"] = [group_id] if group_id is not None else []
        doc.metadata["filename"] = filename
        doc.metadata["created_at"] = upload_timestamp
        doc.metadata["embedding_version"] = EMBEDDING_VERSION
        doc.metadata["document_type"] = document_type
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
                doc.metadata["section_title"] = first_line
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
        section_title = _extract_section_title(chunk.page_content, chunk.metadata.get("section_title") or chunk.metadata.get("section_heading"))
        keywords = _keywords(chunk.page_content, limit=14)
        chunk.metadata["user_id"] = user_id
        chunk.metadata["chunk_index"] = i
        chunk.metadata["chunk_id"] = chunk_id
        chunk.metadata["embedding_id"] = chunk_id
        chunk.metadata["total_chunks"] = len(chunks)
        chunk.metadata["document_id"] = document_id
        chunk.metadata["session_id"] = session_id
        chunk.metadata["group_id"] = group_id
        chunk.metadata["group_ids"] = [group_id] if group_id is not None else []
        chunk.metadata["filename"] = filename
        chunk.metadata["section_title"] = section_title
        chunk.metadata["section_heading"] = section_title
        chunk.metadata["chunk_type"] = _detect_chunk_type(chunk.page_content)
        chunk.metadata["topic"] = _topic_from_keywords(keywords)
        chunk.metadata["keywords"] = keywords
        chunk.metadata["created_at"] = upload_timestamp
        chunk.metadata["embedding_version"] = EMBEDDING_VERSION
        chunk.metadata["document_type"] = document_type
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


def _scan_allowed_docs(vectorstore, user_id: int, allowed_document_ids: set[int]) -> list:
    docs = []
    for doc in vectorstore.docstore._dict.values():
        if _metadata_filter(doc.metadata or {}, user_id, allowed_document_ids):
            docs.append(doc)
    return docs


def _bm25_scores(query: str, docs: list) -> dict[str, float]:
    query_terms = _keywords(query)
    if not query_terms or not docs:
        return {}

    tokenized = [_keywords(doc.page_content) for doc in docs]
    doc_freq = defaultdict(int)
    for terms in tokenized:
        for term in set(terms):
            doc_freq[term] += 1

    avg_len = sum(len(terms) for terms in tokenized) / max(len(tokenized), 1)
    k1 = 1.5
    b = 0.75
    scores = {}
    for doc, terms in zip(docs, tokenized):
        counts = Counter(terms)
        length = max(len(terms), 1)
        score = 0.0
        for term in query_terms:
            if not counts.get(term):
                continue
            idf = math.log(1 + (len(docs) - doc_freq[term] + 0.5) / (doc_freq[term] + 0.5))
            numerator = counts[term] * (k1 + 1)
            denominator = counts[term] + k1 * (1 - b + b * (length / max(avg_len, 1)))
            score += idf * (numerator / denominator)
        if doc.metadata.get("embedding_id"):
            scores[doc.metadata["embedding_id"]] = score
    max_score = max(scores.values(), default=0.0)
    if max_score <= 0:
        return scores
    return {key: value / max_score for key, value in scores.items()}


def _freshness_score(metadata: dict) -> float:
    raw = metadata.get("created_at") or metadata.get("upload_timestamp")
    if not raw:
        return 0.35
    try:
        created_at = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return 0.35
    age_days = max((datetime.now(timezone.utc) - created_at).days, 0)
    return max(0.15, 1.0 - min(age_days, 365) / 365)


def _context_compress(results: list[dict], max_chars: int = 7200) -> list[dict]:
    compressed = []
    seen = set()
    used_chars = 0
    for source in results:
        content = " ".join(source["content"].split())
        fingerprint = " ".join(_keywords(content)[:18])
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        if used_chars + len(content) > max_chars and compressed:
            break
        source["content"] = content[:1800]
        source["snippet"] = source["snippet"][:420]
        used_chars += len(source["content"])
        compressed.append(source)
    return compressed


def retrieve_context(
    query: str,
    user_id: int,
    document_ids: list[int] | None = None,
    top_k: int = 6,
    min_confidence: float = 0.46,
):
    """Multi-stage, user-scoped hybrid retrieval with reranking and compression."""
    allowed_document_ids = set(document_ids or [])
    if not allowed_document_ids:
        return []

    vectorstore = _load_vectorstore(user_id)
    if not vectorstore:
        return []

    allowed_docs = _scan_allowed_docs(vectorstore, user_id, allowed_document_ids)
    bm25 = _bm25_scores(query, allowed_docs)
    raw_by_id = {}

    try:
        for expanded_query in _expanded_queries(query):
            for doc, distance in vectorstore.similarity_search_with_score(expanded_query, k=max(top_k * 8, 32)):
                metadata = doc.metadata or {}
                if not _metadata_filter(metadata, user_id, allowed_document_ids):
                    continue
                embedding_id = metadata.get("embedding_id")
                current = raw_by_id.get(embedding_id)
                if current is None or distance < current[1]:
                    raw_by_id[embedding_id] = (doc, distance)
    except Exception as e:
        print(f"Error retrieving context: {e}")
        return []

    for doc in allowed_docs:
        embedding_id = (doc.metadata or {}).get("embedding_id")
        if embedding_id in bm25 and bm25[embedding_id] > 0.35 and embedding_id not in raw_by_id:
            raw_by_id[embedding_id] = (doc, 1.6)

    query_terms = set(_keywords(query))
    reranked = []
    for doc, distance in raw_by_id.values():
        metadata = doc.metadata or {}
        text_terms = set(_keywords(doc.page_content))
        lexical_overlap = len(query_terms & text_terms) / max(len(query_terms), 1)
        semantic_score = 1 / (1 + max(float(distance), 0.0))
        keyword_score = bm25.get(metadata.get("embedding_id"), 0.0)
        heading_boost = 0.06 if query_terms & set(_keywords(metadata.get("section_title") or "")) else 0.0
        freshness = _freshness_score(metadata)
        confidence = min(
            0.98,
            (semantic_score * 0.50)
            + (keyword_score * 0.22)
            + (lexical_overlap * 0.16)
            + (freshness * 0.06)
            + heading_boost,
        )
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
                "section_heading": metadata.get("section_title") or metadata.get("section_heading"),
                "chunk_type": metadata.get("chunk_type"),
                "topic": metadata.get("topic"),
                "keywords": metadata.get("keywords") or [],
                "document_type": metadata.get("document_type"),
                "source": metadata.get("source"),
            }
        )

    return _context_compress(results)


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


def sync_document_group_metadata(document_id: int, user_id: int, group_ids: list[int]):
    """Keep FAISS metadata aligned with DB workspace membership."""
    repair_user_vector_metadata(
        user_id,
        {
            document_id: {
                "group_ids": sorted({int(group_id) for group_id in group_ids}),
            }
        },
    )


def repair_user_vector_metadata(user_id: int, documents: dict[int, dict]):
    """Patch stored FAISS doc metadata without loading embedding models."""
    index_path = os.path.join(_vectorstore_path(user_id), "index.pkl")
    if not os.path.exists(index_path):
        return

    try:
        with open(index_path, "rb") as file:
            docstore, index_to_docstore_id = pickle.load(file)

        changed = False
        for doc in docstore._dict.values():
            metadata = doc.metadata or {}
            document_id = metadata.get("document_id")
            if document_id is None:
                continue
            try:
                document_id = int(document_id)
            except (TypeError, ValueError):
                continue
            document_payload = documents.get(document_id)
            if not document_payload:
                continue

            updates = {
                "user_id": user_id,
                "document_id": document_id,
                "filename": document_payload.get("filename", metadata.get("filename")),
                "session_id": metadata.get("session_id"),
                "created_at": metadata.get("created_at") or metadata.get("upload_timestamp"),
                "embedding_version": metadata.get("embedding_version") or EMBEDDING_VERSION,
                "section_title": metadata.get("section_title") or metadata.get("section_heading"),
                "chunk_type": metadata.get("chunk_type") or _detect_chunk_type(doc.page_content),
                "keywords": metadata.get("keywords") or _keywords(doc.page_content, limit=14),
                "document_type": metadata.get("document_type") or "notes",
                "upload_timestamp": document_payload.get("upload_timestamp", metadata.get("upload_timestamp")),
            }
            updates["topic"] = metadata.get("topic") or _topic_from_keywords(updates["keywords"])
            updates["section_heading"] = updates["section_title"]
            group_ids = sorted({int(group_id) for group_id in document_payload.get("group_ids", metadata.get("group_ids") or [])})
            updates["group_ids"] = group_ids
            updates["group_id"] = group_ids[0] if group_ids else None

            for key, value in updates.items():
                if metadata.get(key) != value:
                    metadata[key] = value
                    changed = True
            doc.metadata = metadata

        if changed:
            with open(index_path, "wb") as file:
                pickle.dump((docstore, index_to_docstore_id), file)
    except Exception as e:
        print(f"Error repairing vector metadata: {e}")
