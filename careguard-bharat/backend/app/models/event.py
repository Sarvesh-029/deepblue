from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime
from app.core.database import Base


class EventRecord(Base):
    """
    Every event: id, type, timestamp, room/device, blurred snapshot path, severity, stored in database.
    Privacy guarantee: Only blurred snapshot path is stored, never raw video/audio.
    """
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(100), nullable=False, index=True)
    # Types: 'UNKNOWN_VISITOR', 'DEPENDENT_UNATTENDED', 'CAREGIVER_ABSENT', 'DISTRESS_SOUND', 'CAREGIVER_PRESENT'
    
    room_device = Column(String(100), default="Living Room", nullable=False, index=True)
    severity = Column(String(20), default="medium", nullable=False)  # 'low', 'medium', 'high', 'critical'
    snapshot_path = Column(String(500), nullable=True)  # Path to blurred snapshot
    details_json = Column(Text, nullable=True)  # Additional metadata (confidence, duration, etc.)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)


class PresenceLog(Base):
    """
    Tracks presence duration of caregivers per room/device.
    """
    __tablename__ = "presence_logs"

    id = Column(Integer, primary_key=True, index=True)
    caregiver_name = Column(String(255), nullable=False)
    caregiver_person_id = Column(Integer, nullable=True)
    room_device = Column(String(100), nullable=False, index=True)
    session_start = Column(DateTime, nullable=False)
    session_end = Column(DateTime, nullable=True)
    duration_seconds = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class ConsentLog(Base):
    """
    Audit log of explicit consent actions for face enrollment or room monitoring.
    """
    __tablename__ = "consent_logs"

    id = Column(Integer, primary_key=True, index=True)
    subject_name = Column(String(255), nullable=False)
    consent_type = Column(String(100), nullable=False)  # 'FACE_ENROLLMENT', 'ROOM_MONITORING'
    granted_by_user_id = Column(Integer, nullable=False)
    terms_version = Column(String(50), default="1.0", nullable=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
