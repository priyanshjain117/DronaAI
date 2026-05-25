from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Table
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base


chat_session_documents = Table(
    "chat_session_documents",
    Base.metadata,
    Column("session_id", Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), primary_key=True),
    Column("document_id", Integer, ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now()),
)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, default="New Chat")
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    active_document_ids = Column(Text, default="[]", nullable=False)
    active_group_ids = Column(Text, default="[]", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.created_at")
    documents = relationship("Document", secondary=chat_session_documents)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    session = relationship("ChatSession", back_populates="messages")


class RetrievalMetadata(Base):
    __tablename__ = "retrieval_metadata"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    message_id = Column(Integer, ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True, index=True)
    source_label = Column(String, nullable=False)
    chunk_index = Column(Integer, nullable=True)
    page_number = Column(Integer, nullable=True)
    section_heading = Column(String, nullable=True)
    confidence = Column(Float, nullable=False, default=0.0)
    snippet = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
