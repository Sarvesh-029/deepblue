import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_rule_engine
from app.models.user import User
from app.models.event import ConsentLog
from app.models.person import Person
from app.rules.engine import RuleEngine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/monitor", tags=["Room Sentinel Monitor"])


class ConsentRequest(BaseModel):
    room_device: str = "Living Room"
    consent_type: str = "ROOM_MONITORING"
    terms_version: str = "1.0"


class AudioDistressRequest(BaseModel):
    room_device: str = "Living Room"
    sound_class: str = "Crying/Screaming"
    confidence: float = 0.85


class RoomResponse(BaseModel):
    rooms: List[str]


@router.post("/consent")
def record_monitoring_consent(
    req: ConsentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Records explicit user consent prior to initiating camera monitoring on a room device.
    Satisfies Privacy-by-Design and ethical monitoring standards.
    """
    consent_entry = ConsentLog(
        subject_name=f"Room: {req.room_device}",
        consent_type=req.consent_type,
        granted_by_user_id=current_user.id,
        terms_version=req.terms_version,
        timestamp=datetime.now(timezone.utc)
    )
    db.add(consent_entry)
    db.commit()
    db.refresh(consent_entry)

    logger.info(f"Monitoring consent recorded for user {current_user.email} in room '{req.room_device}'")
    return {
        "status": "consent_recorded",
        "consent_id": consent_entry.id,
        "room_device": req.room_device,
        "timestamp": consent_entry.timestamp.isoformat()
    }


@router.post("/frame")
def upload_monitor_frame(
    file: UploadFile = File(..., description="JPEG frame captured on motion (max 640px width)"),
    room_device: str = Form("Living Room"),
    motion_detected: bool = Form(True),
    motion_score: float = Form(0.0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    rule_engine: RuleEngine = Depends(get_rule_engine)
):
    """
    Receives an intermittent frame sent by the room monitor client.
    Privacy rules strictly enforced:
    1. Frames are sent at most once every 4-5 seconds and only when motion is detected.
    2. Client resizes frames to max 640px width before upload.
    3. Backend processes frame through RuleEngine and never stores raw video or raw images.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No frame payload provided")

    image_bytes = file.file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty frame received")

    # Fetch enrolled faces for the current family to feed to the recognition pipeline
    enrolled_persons = db.query(Person).filter(
        Person.family_id == current_user.id,
        Person.consent_given == True
    ).all()

    enrolled_faces = [
        {
            "id": p.id,
            "name": p.name,
            "role_type": p.role_type,
            "embedding": p.face_embedding,
            "shift_start": p.shift_start,
            "shift_end": p.shift_end
        }
        for p in enrolled_persons
    ]

    # Hand off to the RuleEngine
    result = rule_engine.process_frame_event(
        room_device=room_device,
        image_bytes=image_bytes,
        motion_detected=motion_detected,
        enrolled_faces=enrolled_faces
    )

    return {
        "status": "processed",
        "room_device": room_device,
        "motion_detected": motion_detected,
        "motion_score": motion_score,
        "bytes_received": len(image_bytes),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "details": result
    }


@router.post("/audio-distress")
def report_browser_audio_distress(
    req: AudioDistressRequest,
    current_user: User = Depends(get_current_user),
    rule_engine: RuleEngine = Depends(get_rule_engine)
):
    """
    Receives acoustic distress detection results from the browser YAMNet model.
    Privacy Guarantee: Never receives or stores raw audio. Only event type and confidence.
    """
    result = rule_engine.process_audio_distress(
        room_device=req.room_device,
        sound_class=req.sound_class,
        confidence=req.confidence
    )
    return {
        "status": "alert_dispatched",
        "room_device": req.room_device,
        "sound_class": req.sound_class,
        "confidence": req.confidence,
        "event_id": result.get("id"),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/rooms")
def list_monitored_rooms(current_user: User = Depends(get_current_user)):
    """
    Returns suggested room names for device placement.
    """
    return {
        "rooms": [
            "Living Room",
            "Elderly Bedroom (Dadi's Room)",
            "Nursery / Kids Room",
            "Dining Area",
            "Balcony / Entry Hall"
        ]
    }
