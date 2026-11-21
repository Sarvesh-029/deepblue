import json
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.adapters.events.interface import EventStore
from app.models.event import EventRecord, PresenceLog
from app.core.database import SessionLocal


class SQLiteEventStore(EventStore):
    """
    SQLite implementation of EventStore via SQLAlchemy.
    """

    def __init__(self, db_session_factory=SessionLocal):
        self.session_factory = db_session_factory

    def add_event(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        with self.session_factory() as session:
            details = event_data.get("details_json")
            if isinstance(details, dict):
                details = json.dumps(details)

            record = EventRecord(
                event_type=event_data["event_type"],
                room_device=event_data.get("room_device", "Living Room"),
                severity=event_data.get("severity", "medium"),
                snapshot_path=event_data.get("snapshot_path"),
                details_json=details,
                created_at=event_data.get("created_at") or datetime.now(timezone.utc)
            )
            session.add(record)
            session.commit()
            session.refresh(record)
            return {
                "id": record.id,
                "event_type": record.event_type,
                "room_device": record.room_device,
                "severity": record.severity,
                "snapshot_path": record.snapshot_path,
                "details_json": record.details_json,
                "created_at": record.created_at.isoformat()
            }

    def list_events(
        self,
        limit: int = 50,
        offset: int = 0,
        event_type: Optional[str] = None,
        room_device: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            query = session.query(EventRecord)
            if event_type:
                query = query.filter(EventRecord.event_type == event_type)
            if room_device:
                query = query.filter(EventRecord.room_device == room_device)
            records = query.order_by(EventRecord.created_at.desc()).offset(offset).limit(limit).all()
            return [
                {
                    "id": r.id,
                    "event_type": r.event_type,
                    "room_device": r.room_device,
                    "severity": r.severity,
                    "snapshot_path": r.snapshot_path,
                    "details_json": r.details_json,
                    "created_at": r.created_at.isoformat()
                }
                for r in records
            ]

    def log_presence(
        self,
        caregiver_name: str,
        caregiver_person_id: Optional[int],
        room_device: str,
        duration_seconds: int
    ) -> Dict[str, Any]:
        with self.session_factory() as session:
            now = datetime.now(timezone.utc)
            log = PresenceLog(
                caregiver_name=caregiver_name,
                caregiver_person_id=caregiver_person_id,
                room_device=room_device,
                session_start=now - timedelta(seconds=duration_seconds),
                session_end=now,
                duration_seconds=duration_seconds
            )
            session.add(log)
            session.commit()
            session.refresh(log)
            return {
                "id": log.id,
                "caregiver_name": log.caregiver_name,
                "room_device": log.room_device,
                "duration_seconds": log.duration_seconds,
                "session_start": log.session_start.isoformat(),
                "session_end": log.session_end.isoformat()
            }

    def get_recent_presence(self, room_device: Optional[str] = None, minutes: int = 60) -> List[Dict[str, Any]]:
        with self.session_factory() as session:
            since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
            query = session.query(PresenceLog).filter(PresenceLog.session_start >= since)
            if room_device:
                query = query.filter(PresenceLog.room_device == room_device)
            logs = query.order_by(PresenceLog.session_start.desc()).all()
            return [
                {
                    "id": p.id,
                    "caregiver_name": p.caregiver_name,
                    "caregiver_person_id": p.caregiver_person_id,
                    "room_device": p.room_device,
                    "duration_seconds": p.duration_seconds,
                    "session_start": p.session_start.isoformat(),
                    "session_end": p.session_end.isoformat() if p.session_end else None
                }
                for p in logs
            ]
