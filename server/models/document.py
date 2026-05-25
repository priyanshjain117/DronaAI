from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Table
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base


group_documents = Table(
    "group_documents",
    Base.metadata,
    Column("group_id", Integer, ForeignKey("document_groups.id", ondelete="CASCADE"), primary_key=True),
    Column("document_id", Integer, ForeignKey("documents.id", ondelete="CASCADE"), primary_key=True),
    Column("created_at", DateTime(timezone=True), server_default=func.now()),
)


class DocumentGroup(Base):
    __tablename__ = "document_groups"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    slug = Column(String, nullable=False, index=True)
    description = Column(Text, default="", nullable=False)
    color = Column(String, default="#F97316", nullable=False)
    sort_order = Column(Integer, default=0, nullable=False)
    memory = Column(Text, default="", nullable=False)
    retrieval_preferences = Column(Text, default="{}", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    documents = relationship("Document", secondary=group_documents, back_populates="groups")

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    filename = Column(String, index=True)
    file_path = Column(String)
    file_type = Column(String)
    embedding_namespace = Column(String, nullable=True, index=True)
    status = Column(String, default="indexed", nullable=False)
    chunk_count = Column(Integer, default=0, nullable=False)
    document_metadata = Column(Text, default="{}", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    groups = relationship("DocumentGroup", secondary=group_documents, back_populates="documents")


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_text = Column(Text, nullable=False)
    embedding_id = Column(String, unique=True, nullable=False, index=True)
    chunk_metadata = Column(Text, default="{}", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    document = relationship("Document", back_populates="chunks")
