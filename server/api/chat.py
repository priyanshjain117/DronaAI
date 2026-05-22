import os
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain

from api.deps import get_current_user
from models.user import User
from db.session import get_db
from rag.pipeline import get_retriever

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    document_id: int | None = None

@router.post("/")
async def chat_with_docs(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    retriever = get_retriever(request.document_id)
    if not retriever:
        raise HTTPException(status_code=400, detail="No documents uploaded yet.")

    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(status_code=500, detail="Groq API key not configured.")

    llm = ChatGroq(temperature=0, model_name="llama-3.1-8b-instant", groq_api_key=groq_api_key)
    
    system_prompt = (
        "You are an AI Study Assistant. Answer the user's question based ONLY on the provided context. "
        "If the answer is not in the context, say 'I cannot find the answer in the uploaded documents.'\n\n"
        "Context:\n{context}"
    )

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("human", "{input}"),
    ])

    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    rag_chain = create_retrieval_chain(retriever, question_answer_chain)

    async def generate():
        async for chunk in rag_chain.astream({"input": request.message}):
            if "answer" in chunk:
                print(f"GROQ CHUNK: '{chunk['answer']}'", flush=True)
                # Send Server-Sent Events format
                yield f"data: {json.dumps({'text': chunk['answer']})}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")
