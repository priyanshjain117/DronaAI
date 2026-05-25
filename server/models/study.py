from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from .database import Base


class StudyMaterial(Base):
    __tablename__ = "study_materials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    material_type = Column(String, nullable=False, index=True)
    mode = Column(String, nullable=False, index=True)
    difficulty = Column(String, default="medium", nullable=False)
    title = Column(String, nullable=False)
    query = Column(Text, default="", nullable=False)
    content_json = Column(Text, default="{}", nullable=False)
    source_document_ids = Column(Text, default="[]", nullable=False)
    source_group_ids = Column(Text, default="[]", nullable=False)
    confidence = Column(String, default="0", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    progress = relationship("StudyProgress", back_populates="material", cascade="all, delete-orphan")


class StudyProgress(Base):
    __tablename__ = "study_progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    material_id = Column(Integer, ForeignKey("study_materials.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String, nullable=False, index=True)
    status = Column(String, default="new", nullable=False)
    marked_difficult = Column(Boolean, default=False, nullable=False)
    correct_count = Column(Integer, default=0, nullable=False)
    wrong_count = Column(Integer, default=0, nullable=False)
    last_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    material = relationship("StudyMaterial", back_populates="progress")
