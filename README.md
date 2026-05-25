# DronaAI

### AI-Powered Study Workspace for Serious Learners

DronaAI is an advanced AI educational workspace that helps students upload notes, organize knowledge into focused workspaces, chat with documents through a multi-stage RAG pipeline, generate revision material, create flashcards and MCQs, and prepare for exams with grounded AI assistance.

It is designed like a modern learning operating system: context-aware, source-grounded, workspace-driven, and built for students who need more than a generic chatbot.

---

## Badges

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.136-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)
![LangChain](https://img.shields.io/badge/LangChain-RAG-1C3C3C?style=for-the-badge)
![OpenAI](https://img.shields.io/badge/OpenAI-Compatible-412991?style=for-the-badge&logo=openai&logoColor=white)
![FAISS](https://img.shields.io/badge/FAISS-Vector_Search-FF6B00?style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Ready-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-Components-111827?style=for-the-badge)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-ORM-D71F00?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

> Current implementation uses **Groq-hosted Llama 3.1** for generation and **HuggingFace all-MiniLM-L6-v2** embeddings with **FAISS**. The architecture is provider-agnostic and can be adapted to OpenAI models, Pinecone, PostgreSQL, or other production retrieval stacks.

---

## Project Overview

Students rarely struggle because information is unavailable. They struggle because information is fragmented across PDFs, lecture notes, assignments, textbooks, slides, and screenshots. Generic AI tools help explain concepts, but they usually do not understand a student's actual material, course context, or exam priorities.

DronaAI solves this by combining:

| Capability | What It Does |
| --- | --- |
| Document-grounded AI chat | Answers questions using uploaded notes and cites retrieved source chunks. |
| Workspace-based retrieval | Groups related notes into focused learning spaces such as `@calculus`, `@nlp`, or `@interview-prep`. |
| Session-aware memory | Keeps active documents/workspaces attached to the chat session. |
| Study material generation | Converts notes into summaries, flashcards, MCQs, and revision plans. |
| Hybrid RAG | Combines semantic search, keyword retrieval, reranking, metadata filtering, and context compression. |
| Citation intelligence | Shows source cards only when retrieved sources are actually used in the generated answer. |

---

## Selected Problem Statement

### The Problem

Traditional study workflows are inefficient because students must manually:

- Search across many disconnected documents.
- Summarize dense lecture material.
- Convert notes into flashcards and practice questions.
- Track which documents are relevant to a specific exam or topic.
- Verify whether AI answers are grounded in their actual material.

Generic chatbots add another limitation: they may explain concepts well, but they usually cannot reliably scope retrieval to a student's own notes, workspace, or previous chat context.

### DronaAI's Solution

DronaAI introduces a workspace-based AI study system:

- Upload notes once.
- Chunk, embed, enrich, and index them.
- Assign documents to smart workspaces.
- Ask natural questions across specific workspaces or notes.
- Generate exam-focused revision artifacts grounded in source material.
- Preserve sessions, citations, and retrieval plans.

The result is a serious AI-powered study environment, not a one-off document chatbot.

---

## Key Features

| Feature | Description |
| --- | --- |
| AI Chat with Notes | Chat with PDFs and text files using retrieved context. |
| Advanced RAG Retrieval | Semantic search, query expansion, BM25-style lexical scoring, reranking, and compression. |
| Workspace Knowledge Groups | Organize documents into reusable study spaces with `@workspace` references. |
| Multi-Document Reasoning | Retrieve across many selected documents or entire workspaces. |
| Smart Citations | Inline `[S1]` citations and source cards for used chunks. |
| Session-Aware Memory | Chat sessions remember active documents and workspaces. |
| Flashcard Generation | Active-recall cards grounded in retrieved material. |
| MCQ Generation | Exam-style multiple choice questions with explanations. |
| Revision Sheets | High-yield revision notes, formulas, concept maps, and likely questions. |
| Intelligent Summaries | Short, detailed, exam, bullet, and beginner-friendly summary modes. |
| Contextual Retrieval | Retrieval scope adapts to query intent and active workspace. |
| Cross-Document Learning | Compares concepts, summarizes workspaces, and synthesizes multiple sources. |

---

## System Architecture

### A. High-Level System Architecture

```mermaid
flowchart LR
    User[Student] --> UI[Next.js Frontend]
    UI -->|JWT + API requests| API[FastAPI Backend]

    API --> Auth[Auth + User Isolation]
    API --> Sessions[Chat Sessions]
    API --> Study[Study Tools API]
    API --> Upload[Document Upload API]
    API --> Groups[Workspace Groups API]

    Upload --> Ingestion[Document Ingestion Pipeline]
    Ingestion --> Embeddings[Embedding Model]
    Embeddings --> VectorDB[(FAISS Vector Store)]

    API --> Retrieval[Retrieval Engine]
    Retrieval --> VectorDB
    Retrieval --> SQL[(SQLite / PostgreSQL)]
    Retrieval --> LLM[LLM Provider]

    Sessions --> SQL
    Study --> SQL
    Groups --> SQL
    Auth --> SQL

    LLM --> API
    API -->|Streaming response + metadata| UI
```

### Frontend Architecture

```mermaid
flowchart TD
    App[Next.js App Router] --> Providers[React Query Provider + Theme Sync]
    App --> Public[Home / Login / Signup]
    App --> Workspace[Authenticated Workspace]

    Workspace --> Sidebar[Workspace Sidebar]
    Workspace --> Dashboard[Dashboard]
    Workspace --> Chat[AI Tutor Chat]
    Workspace --> Study[Study Tools]

    Chat --> Composer[Smart Input Composer]
    Chat --> Messages[Markdown Response Cards]
    Chat --> Sources[Evidence Cards]

    Study --> Generator[Material Generator]
    Study --> Flashcards[Flashcards]
    Study --> MCQ[MCQ Test]
    Study --> Revision[Revision Workspace]

    Providers --> Store[Zustand Persisted Store]
    Providers --> Query[TanStack Query Cache]
```

### Backend Architecture

```mermaid
flowchart TD
    FastAPI[FastAPI Application] --> AuthAPI[/auth/]
    FastAPI --> UploadAPI[/upload/]
    FastAPI --> ChatAPI[/chat/]
    FastAPI --> SessionAPI[/sessions/]
    FastAPI --> GroupAPI[/groups/]
    FastAPI --> StudyAPI[/study/]

    AuthAPI --> Users[(users)]
    UploadAPI --> Documents[(documents)]
    UploadAPI --> Chunks[(document_chunks)]
    UploadAPI --> RAG[rag.pipeline]

    ChatAPI --> Intent[Query Classification]
    ChatAPI --> Scope[Scope Resolver]
    ChatAPI --> RAG
    ChatAPI --> LLM[ChatGroq / LLM Provider]
    ChatAPI --> ChatDB[(chat_sessions + messages)]

    GroupAPI --> Workspaces[(document_groups)]
    StudyAPI --> StudyDB[(study_materials + progress)]
    StudyAPI --> RAG
    StudyAPI --> LLM
```

---

## Document Ingestion Pipeline

When a student uploads a PDF or TXT file, DronaAI transforms it into a searchable learning asset.

```mermaid
flowchart TD
    Upload[PDF / TXT Upload] --> Validate[Validate File Type]
    Validate --> Loader[PyPDFLoader / TextLoader]
    Loader --> Extract[Text Extraction]
    Extract --> DetectDoc[Document Type Detection]
    DetectDoc --> Chunk[Semantic Chunking]
    Chunk --> Enrich[Metadata Enrichment]
    Enrich --> Embed[Embedding Generation]
    Embed --> StoreVector[FAISS Vector Storage]
    Enrich --> StoreSQL[Persist Chunk Metadata in SQL]
    StoreVector --> Workspace[Workspace Assignment]
    StoreSQL --> DocumentReady[Indexed Document Ready]
    Workspace --> DocumentReady
```

The chunking layer enriches each chunk with metadata such as section heading, page number, topic keywords, document type, chunk type, embedding version, and user scope.

---

## Advanced RAG Pipeline

```mermaid
flowchart TD
    Query[User Query] --> Classifier[Query Understanding]
    Classifier --> Resolver[Workspace + Document Scope Resolution]
    Resolver --> MetadataFilter[User + Document Metadata Filtering]
    MetadataFilter --> Expansion[Query Expansion]
    Expansion --> Semantic[Semantic Vector Search]
    Expansion --> Lexical[BM25-Style Keyword Search]
    Semantic --> Merge[Candidate Merge]
    Lexical --> Merge
    Merge --> Rerank[Hybrid Reranking]
    Rerank --> Confidence[Confidence Thresholding]
    Confidence --> Compress[Context Compression]
    Compress --> Prompt[Grounded Prompt Construction]
    Prompt --> LLM[LLM Response Generation]
    LLM --> Citations[Citation Extraction]
    Citations --> Response[Streaming Answer + Source Cards]
```

### Retrieval Scoring Signals

| Signal | Purpose |
| --- | --- |
| Semantic similarity | Finds conceptually relevant chunks. |
| BM25-style keyword score | Recovers exact terms, definitions, formulas, and named concepts. |
| Lexical overlap | Rewards direct query-term matches. |
| Heading boost | Promotes chunks whose headings match the query. |
| Freshness score | Slightly prefers recent uploads. |
| Confidence threshold | Prevents weak evidence from polluting the prompt. |

---

## AI Agent Workflow

DronaAI's backend behaves like a coordinated retrieval-and-synthesis system.

```mermaid
flowchart LR
    UserQuery[Student Query] --> QUA[Query Understanding Agent]
    QUA --> RPA[Retrieval Planning Agent]
    RPA --> WRE[Workspace Resolution Engine]
    WRE --> MFE[Metadata Filter Engine]
    MFE --> HR[Hybrid Retriever]
    HR --> RR[Reranker]
    RR --> CCE[Context Compression Engine]
    CCE --> RSI[Response Synthesizer]
    RSI --> CIS[Citation Intelligence System]
    CIS --> Final[Grounded Tutor Response]
```

| Agent / Engine | Responsibility | Input | Output |
| --- | --- | --- | --- |
| Query Understanding Agent | Classifies intent such as greeting, summary, comparison, MCQ, flashcard, or retrieval-required. | Raw user message | Intent label |
| Retrieval Planning Agent | Chooses retrieval depth and confidence thresholds. | Intent + scope | Retrieval plan |
| Workspace Resolution Engine | Resolves explicit docs, `@workspace` mentions, session scope, or semantic fallback. | Query + session | Candidate documents |
| Metadata Filter Engine | Enforces user isolation and document scope. | Candidate chunks | User-owned chunks only |
| Hybrid Retriever | Combines vector similarity and lexical scoring. | Expanded queries | Candidate context |
| Reranker | Scores candidates using semantic, lexical, freshness, and heading signals. | Retrieved chunks | Ranked evidence |
| Context Compression Engine | Deduplicates and trims context for prompt efficiency. | Ranked chunks | Compact source context |
| Response Synthesizer | Builds educational answer using source context and conversation history. | Prompt + memory | Markdown response |
| Citation Intelligence System | Sends only citations that were actually used in the answer. | Response text + sources | Source cards |

---

## Chat Session Flow

```mermaid
sequenceDiagram
    participant U as Student
    participant UI as Next.js Chat UI
    participant API as FastAPI /chat
    participant DB as SQL Database
    participant R as Retrieval Engine
    participant V as FAISS Vector Store
    participant L as LLM Provider

    U->>UI: Ask question or mention @workspace
    UI->>API: POST /chat with session_id, document_ids, group_ids
    API->>DB: Resolve or create chat session
    API->>DB: Persist user message
    API->>DB: Load recent message history
    API->>DB: Resolve active documents/workspaces
    API->>R: Retrieve context for scoped documents
    R->>V: Similarity search + metadata filtering
    R->>R: BM25 scoring, reranking, compression
    R-->>API: Source context + confidence
    API->>L: Prompt with history, scope, memory, source context
    L-->>API: Stream response chunks
    API-->>UI: Stream answer + retrieval metadata
    API->>DB: Persist assistant message and citations
```

---

## Workspace System

Workspaces are named groups of documents used to control retrieval scope.

Examples:

- `@machine-learning`
- `@semester-5`
- `@operating-systems`
- `@interview-prep`

```mermaid
flowchart TD
    Workspace[Document Workspace] --> Docs[Multiple Documents]
    Docs --> Chunks[Chunk Metadata]
    Chunks --> VectorScope[Vector Metadata group_ids]
    Workspace --> Memory[Workspace Memory]
    Workspace --> Preferences[Retrieval Preferences]
    UserQuery["@workspace query"] --> Resolver[Workspace Resolver]
    Resolver --> VectorScope
    VectorScope --> Retrieval[Scoped Retrieval]
```

Workspace-based retrieval matters because students often study by unit, exam, class, or topic rather than by individual file.

---

## AI Study Tools Workflow

DronaAI does not only answer questions. It transforms uploaded material into study assets.

```mermaid
flowchart TD
    ToolRequest[Study Tool Request] --> Scope[Resolve Documents + Workspaces]
    Scope --> SourceQuery[Generate Source Query]
    SourceQuery --> Retrieve[Retrieve High-Value Chunks]
    Retrieve --> Grounding[Build Grounded Study Prompt]
    Grounding --> JSON[LLM Strict JSON Generation]
    JSON --> Parse[Parse + Validate]
    Parse --> Persist[Save Study Material]
    Persist --> UI[Render Flashcards / MCQs / Revision / Summary]
    UI --> Progress[Track Student Progress]
```

### Study Tools

| Tool | Output | Use Case |
| --- | --- | --- |
| Summary | Sections, bullets, definitions, likely questions | Understand notes quickly |
| Flashcards | Active-recall cards | Memorization and spaced repetition |
| MCQ Test | Four-option questions and explanations | Exam practice |
| Revision | High-yield notes, formulas, concept maps, important questions | Last-mile exam preparation |

---

## Tech Stack

### Frontend

| Technology | Purpose |
| --- | --- |
| Next.js 16 | App Router frontend and routing |
| React 19 | UI rendering |
| TypeScript | Type-safe frontend development |
| TailwindCSS 4 | Design system and styling |
| shadcn/ui | UI primitives |
| Zustand | Persisted auth, sidebar, and theme state |
| TanStack Query | API caching and mutations |
| Framer Motion | Premium transitions and micro-interactions |
| React Markdown | AI response rendering |

### Backend

| Technology | Purpose |
| --- | --- |
| FastAPI | API server |
| Python | Backend runtime |
| SQLAlchemy | ORM and database models |
| Pydantic | Request validation |
| JWT / python-jose | Authentication |
| Passlib / bcrypt | Password hashing |
| Uvicorn | ASGI server |

### AI / RAG

| Technology | Purpose |
| --- | --- |
| LangChain | Document loaders, LLM messaging, retrieval utilities |
| Groq Llama 3.1 | Current LLM generation provider |
| HuggingFace Embeddings | Local sentence-transformer embeddings |
| FAISS | Local vector similarity index |
| BM25-style scoring | Lexical retrieval signal |
| Query Expansion | Better semantic recall |
| Reranking Heuristics | Higher precision retrieval |

### Database

| Technology | Purpose |
| --- | --- |
| SQLite | Local default development database |
| PostgreSQL | Recommended production database target |
| FAISS Filesystem Index | Per-user vector index storage |

### DevOps / Deployment

| Technology | Purpose |
| --- | --- |
| Vercel | Frontend deployment |
| Railway / Render | Backend deployment |
| Docker | Containerized production option |
| Environment Variables | Secret and provider configuration |

---

## Repository Structure

<details>
<summary><strong>Expand project map</strong></summary>

```text
DronaAI/
├── frontend/
│   ├── src/app/              # Next.js routes: dashboard, chat, study, auth
│   ├── src/components/       # Sidebar, upload, cards, UI primitives
│   ├── src/services/         # API client
│   └── src/store/            # Zustand persisted state
├── server/
│   ├── api/                  # FastAPI route modules
│   ├── db/                   # SQLAlchemy engine/session
│   ├── models/               # ORM models
│   ├── rag/                  # Ingestion, FAISS, retrieval, reranking
│   ├── uploads/              # Local uploaded files
│   └── main.py               # FastAPI application entrypoint
└── README.md
```

</details>

---

## Implementation Approach

### Why Workspace Grouping?

Students think in topics and exams, not file IDs. Workspaces let retrieval operate over meaningful knowledge sets instead of arbitrary single documents.

### Why Advanced RAG?

Simple vector search is often not enough for educational tasks. Students ask about formulas, definitions, named techniques, comparisons, and exam wording. DronaAI combines semantic search with lexical scoring and metadata filtering to improve retrieval precision.

### Why Metadata Filtering?

Metadata filtering is critical for:

- User isolation.
- Workspace-specific retrieval.
- Multi-document reasoning.
- Source attribution.
- Preventing unrelated chunks from entering the prompt.

### Why Context Compression?

LLM context windows are limited. Compression removes duplicate chunks, trims long passages, and keeps the most relevant evidence available for synthesis.

---

## Database Design

```mermaid
erDiagram
    USERS ||--o{ DOCUMENTS : owns
    USERS ||--o{ DOCUMENT_GROUPS : owns
    USERS ||--o{ CHAT_SESSIONS : owns
    USERS ||--o{ STUDY_MATERIALS : owns

    DOCUMENTS ||--o{ DOCUMENT_CHUNKS : contains
    DOCUMENTS }o--o{ DOCUMENT_GROUPS : grouped_by
    CHAT_SESSIONS ||--o{ CHAT_MESSAGES : contains
    CHAT_SESSIONS }o--o{ DOCUMENTS : attaches
    CHAT_MESSAGES ||--o{ RETRIEVAL_METADATA : cites

    STUDY_MATERIALS ||--o{ STUDY_PROGRESS : tracks

    USERS {
        int id PK
        string email
        string hashed_password
        datetime created_at
    }

    DOCUMENTS {
        int id PK
        int user_id FK
        string filename
        string file_path
        string file_type
        string embedding_namespace
        string status
        int chunk_count
        text document_metadata
    }

    DOCUMENT_CHUNKS {
        int id PK
        int document_id FK
        text chunk_text
        string embedding_id
        text chunk_metadata
    }

    DOCUMENT_GROUPS {
        int id PK
        int user_id FK
        string name
        string slug
        string color
        text memory
        text retrieval_preferences
    }

    CHAT_SESSIONS {
        int id PK
        int user_id FK
        string title
        text active_document_ids
        text active_group_ids
    }

    CHAT_MESSAGES {
        int id PK
        int session_id FK
        string role
        text content
    }

    RETRIEVAL_METADATA {
        int id PK
        int session_id FK
        int message_id FK
        int document_id FK
        string source_label
        float confidence
        text snippet
    }

    STUDY_MATERIALS {
        int id PK
        int user_id FK
        string material_type
        string mode
        string difficulty
        text content_json
        string confidence
    }

    STUDY_PROGRESS {
        int id PK
        int user_id FK
        int material_id FK
        string item_id
        string status
        bool marked_difficult
        int correct_count
        int wrong_count
    }
```

---

## Vector Metadata Structure

Each embedded chunk carries retrieval metadata similar to:

```json
{
  "user_id": 1,
  "document_id": 42,
  "session_id": null,
  "group_id": 7,
  "group_ids": [7, 9],
  "filename": "neural-networks.pdf",
  "section_heading": "Backpropagation",
  "topic": "gradient, loss, chain, weights",
  "chunk_type": "section",
  "document_type": "notes",
  "chunk_index": 12,
  "embedding_id": "doc42_chunk12_...",
  "embedding_version": "huggingface:all-MiniLM-L6-v2:v1",
  "created_at": "2026-05-25T10:30:00Z",
  "upload_timestamp": "2026-05-25T10:30:00Z"
}
```

Metadata filtering prevents cross-user leakage, enables workspace-scoped retrieval, supports precise citations, and helps the system reason about document type, chunk type, freshness, and topic.

---

## Retrieval Workflow

1. **Query classification**  
   Detect whether the message is conversational, document-specific, summary-oriented, comparison-based, flashcard-oriented, MCQ-oriented, or citation-required.

2. **Workspace resolution**  
   Resolve explicit document IDs, active session documents, active workspace IDs, and `@workspace` mentions.

3. **Semantic retrieval**  
   Run FAISS similarity search over expanded query variants.

4. **BM25-style lexical retrieval**  
   Recover exact matches for formulas, definitions, technical terms, and named concepts.

5. **Reranking**  
   Combine semantic score, keyword score, lexical overlap, heading boost, and freshness.

6. **Context compression**  
   Deduplicate and trim chunks before prompt construction.

7. **LLM synthesis**  
   Generate a student-friendly answer using retrieved evidence, conversation history, active workspace memory, and citation rules.

```mermaid
sequenceDiagram
    participant API as Chat API
    participant C as Classifier
    participant S as Scope Resolver
    participant V as FAISS
    participant B as BM25 Scorer
    participant R as Reranker
    participant P as Prompt Builder
    participant L as LLM

    API->>C: classify(message)
    C-->>API: intent
    API->>S: resolve documents/workspaces/session
    S-->>API: candidate_document_ids
    API->>V: similarity_search(expanded_queries)
    API->>B: keyword_scores(query, allowed_docs)
    V-->>R: semantic candidates
    B-->>R: lexical scores
    R-->>API: ranked sources
    API->>P: context + history + workspace memory
    P->>L: grounded prompt
    L-->>API: streamed response
```

---

## API Surface

| Endpoint | Purpose |
| --- | --- |
| `POST /auth/signup` | Create user account |
| `POST /auth/login` | Authenticate user and issue JWT |
| `GET /upload/` | List uploaded documents |
| `POST /upload/` | Upload and index a PDF/TXT document |
| `DELETE /upload/{id}` | Delete document and vector chunks |
| `POST /chat/` | Stream AI chat response |
| `GET /sessions/` | List chat sessions |
| `GET /sessions/{id}` | Load a chat session |
| `DELETE /sessions/{id}` | Delete a chat session |
| `GET /groups/` | List document workspaces |
| `POST /groups/` | Create workspace |
| `POST /groups/{group_id}/documents/{document_id}` | Attach document to workspace |
| `POST /study/generate` | Generate summary, flashcards, MCQs, or revision material |
| `GET /study/materials` | List saved study material |
| `GET /study/materials/{id}` | Load saved study material |
| `PATCH /study/materials/{id}/progress/{item_id}` | Update study progress |
| `GET /health` | Health check |

---

## APIs, Models, and Tools Used

| Tool / API | Current Usage |
| --- | --- |
| Groq API | LLM generation through `llama-3.1-8b-instant` |
| OpenAI API | Provider-compatible option for future GPT-based deployments |
| HuggingFace Sentence Transformers | Embedding generation through `all-MiniLM-L6-v2` |
| LangChain | Document loading, text splitting, LLM message abstractions |
| FAISS | Local vector search |
| SQLAlchemy | Persistence layer |
| React Markdown + rehype-highlight | Rich markdown and code rendering |

---

## Local Setup

### Prerequisites

- Node.js 20+
- Python 3.11+
- npm
- A Groq API key for the current LLM provider
- Optional: PostgreSQL for production-like database testing

### Installation

```bash
git clone https://github.com/<your-org>/DronaAI.git
cd DronaAI
```

### Backend Setup

```bash
cd server
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000
```

The backend defaults to SQLite at `server/drona_ai.db` if `DATABASE_URL` is not provided.

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open:

```text
http://localhost:3000
```

### Full Local Run

```bash
# Terminal 1
cd server
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend
npm run dev
```

---

## Environment Variables

### `server/.env.example`

```env
# Required for current LLM generation provider
GROQ_API_KEY=your_groq_api_key

# Optional if switching to OpenAI-compatible generation or embeddings
OPENAI_API_KEY=your_openai_api_key

# Local default: sqlite:///./drona_ai.db
# Production recommended: postgresql+psycopg://user:password@host:5432/dronaai
DATABASE_URL=sqlite:///./drona_ai.db

# JWT signing secret
JWT_SECRET=replace_with_a_long_random_secret

# Optional production vector database URL if replacing local FAISS
VECTOR_DB_URL=

# Optional environment marker
ENVIRONMENT=development
```

### `frontend/.env.example`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Current LLM provider key used by chat and study generation. |
| `OPENAI_API_KEY` | Optional provider key if adapting to OpenAI models. |
| `DATABASE_URL` | SQL database connection string. |
| `JWT_SECRET` | Secret used to sign authentication tokens. |
| `VECTOR_DB_URL` | Optional vector DB endpoint for Pinecone or similar production systems. |
| `NEXT_PUBLIC_API_URL` | Frontend API base URL. |

---

## Screenshots

> Replace these placeholders with production screenshots or demo assets.

| Dashboard | AI Chat |
| --- | --- |
| ![Dashboard](docs/screenshots/dashboard.png) | ![AI Chat](docs/screenshots/chat.png) |

| Flashcards | Revision Workspace |
| --- | --- |
| ![Flashcards](docs/screenshots/flashcards.png) | ![Revision Workspace](docs/screenshots/revision.png) |

| MCQ Test | Workspace Groups |
| --- | --- |
| ![MCQ Test](docs/screenshots/mcq.png) | ![Workspace Groups](docs/screenshots/workspaces.png) |

---

## Demo Video

[Add YouTube / Google Drive Link Here]

---

## Future Improvements

- OCR support for scanned PDFs and handwritten notes.
- Voice AI tutor for spoken explanations.
- Personalized learning paths based on weak topics.
- True spaced repetition scheduling.
- AI-generated study calendars and exam plans.
- Collaborative workspaces for study groups.
- Mobile app experience.
- Pinecone or managed vector database support.
- Cross-encoder reranker integration.
- Instructor dashboards and classroom analytics.

---

## Contributing

Contributions are welcome. Please keep changes focused, documented, and aligned with the product direction.

### Suggested Workflow

```bash
git checkout -b feature/your-feature-name
npm run lint
npm run build
git commit -m "feat: add your feature"
git push origin feature/your-feature-name
```

### Pull Request Checklist

- Explain the user-facing change.
- Include screenshots for UI updates.
- Add backend/API notes if endpoints or schemas changed.
- Verify frontend lint/build.
- Verify backend starts successfully.
- Keep unrelated refactors out of the PR.

### Branching Strategy

| Branch | Purpose |
| --- | --- |
| `main` | Stable production-ready code |
| `dev` | Integration branch |
| `feature/*` | New product or engineering work |
| `fix/*` | Bug fixes |
| `docs/*` | Documentation updates |

---

## License

This project is licensed under the MIT License.

```text
MIT License

Copyright (c) 2026 DronaAI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Why DronaAI Matters

DronaAI is built around a simple idea: AI studying should be grounded, organized, contextual, and actionable. Instead of asking students to adapt to a chatbot, DronaAI adapts retrieval, memory, citations, and study tooling around how students actually learn.

It is a foundation for the future of AI-powered education: a serious learning workspace where notes become knowledge, conversations become revision, and exam preparation becomes intelligent.
