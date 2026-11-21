from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base


class Person(Base):
    """
    Enrolled individuals (Family members, Dependents, or Caregivers).
    Enrolled only WITH explicit consent.
    """
    __tablename__ = "enrolled_persons"

    id = Column(Integer, primary_key=True, index=True)
    family_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    role_type = Column(String(50), nullable=False)  # 'family', 'dependent', 'caregiver'
    
    # Explicit Consent Tracking
    consent_given = Column(Boolean, default=False, nullable=False)
    consent_timestamp = Column(DateTime, nullable=True)
    consent_signed_by = Column(String(255), nullable=True)
    
    # Face Embedding (Stored as JSON array of floats from SFace - 128-d vector)
    face_embedding = Column(Text, nullable=True)
    
    # Caregiver Shift Schedule (e.g., "09:00" - "18:00")
    shift_start = Column(String(10), nullable=True)
    shift_end = Column(String(10), nullable=True)
    
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    family_owner = relationship("User", back_populates="enrolled_persons")
