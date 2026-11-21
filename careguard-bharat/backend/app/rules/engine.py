import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from app.adapters.face.interface import FaceService
from app.adapters.storage.interface import SnapshotStorage
from app.adapters.alerts.interface import AlertService
from app.adapters.events.interface import EventStore
from app.core.config import settings

logger = logging.getLogger(__name__)


class RoomState:
    """Tracks state and session telemetry for a specific room/device."""
    def __init__(self, room_device: str):
        self.room_device = room_device
        self.last_seen_time: Optional[datetime] = None
        
        # Caregiver tracking
        self.last_caregiver_seen: Optional[datetime] = None
        self.last_caregiver_name: Optional[str] = None
        self.last_caregiver_id: Optional[int] = None
        self.current_caregiver_session_start: Optional[datetime] = None
        self.current_caregiver_last_seen: Optional[datetime] = None
        self.total_presence_seconds: int = 0
        
        # Dependent tracking
        self.last_dependent_seen: Optional[datetime] = None
        self.last_dependent_name: Optional[str] = None
        self.dependent_alone_since: Optional[datetime] = None
        self.last_unattended_alert_time: Optional[datetime] = None


class RuleEngine:
    """
    CareGuard Bharat Safety & Caregiver Rules Engine.
    Crucial Architectural Rule: Business logic ONLY talks to Adapter interfaces,
    never directly to SQLite, OpenCV, local disk, or specific cloud SDKs.
    
    Supported Rules:
    - UNKNOWN_VISITOR: Unrecognized face detected in monitored room -> event + blurred snapshot + alert.
    - DEPENDENT_UNATTENDED: Dependent present with no caregiver for > N minutes (default 10).
    - CAREGIVER_PRESENCE: Room/device presence duration logging and arrival detection.
    - CAREGIVER_ABSENT: Shift started but caregiver not recognised within 30 min (evaluated by scheduler).
    - DISTRESS_SOUND: Acoustic distress (crying, screams, shouting) from browser YAMNet.
    """

    def __init__(
        self,
        face_service: FaceService,
        storage_service: SnapshotStorage,
        alert_service: AlertService,
        event_store: EventStore,
        unattended_threshold_minutes: int = settings.DEFAULT_UNATTENDED_MINUTES
    ):
        self.face = face_service
        self.storage = storage_service
        self.alerts = alert_service
        self.events = event_store
        self.unattended_threshold = unattended_threshold_minutes
        self._room_states: Dict[str, RoomState] = {}
        self.unattended_alert_cooldown_minutes = 5

    def _get_or_create_room_state(self, room_device: str) -> RoomState:
        if room_device not in self._room_states:
            self._room_states[room_device] = RoomState(room_device)
        return self._room_states[room_device]

    def set_unattended_threshold(self, minutes: int):
        self.unattended_threshold = max(1, minutes)
        logger.info(f"RuleEngine: Updated unattended threshold to {self.unattended_threshold} minutes.")

    def get_room_state(self, room_device: str) -> Dict[str, Any]:
        state = self._get_or_create_room_state(room_device)
        return {
            "room_device": state.room_device,
            "last_caregiver_seen": state.last_caregiver_seen.isoformat() if state.last_caregiver_seen else None,
            "last_caregiver_name": state.last_caregiver_name,
            "last_dependent_seen": state.last_dependent_seen.isoformat() if state.last_dependent_seen else None,
            "last_dependent_name": state.last_dependent_name,
            "total_presence_seconds": state.total_presence_seconds,
            "unattended_threshold_minutes": self.unattended_threshold
        }

    def process_frame_event(
        self,
        room_device: str,
        image_bytes: bytes,
        motion_detected: bool,
        enrolled_faces: List[Dict[str, Any]],
        override_now: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Processes an incoming motion frame from the monitor client.
        1. Detects faces with FaceService (and counts persons if YOLO enabled).
        2. Matches detected faces against enrolled members.
        3. Evaluates UNKNOWN_VISITOR.
        4. Evaluates CAREGIVER_PRESENCE.
        5. Evaluates DEPENDENT_UNATTENDED.
        """
        now = override_now or datetime.now(timezone.utc)
        state = self._get_or_create_room_state(room_device)
        state.last_seen_time = now

        # 1. Face detection
        detected_faces = self.face.detect_faces(image_bytes)
        face_bboxes = [f["bbox"] for f in detected_faces] if detected_faces else []

        recognized_persons = []
        unknown_faces_count = 0

        if detected_faces:
            for face_item in detected_faces:
                embedding = self.face.extract_embedding(image_bytes, face_item.get("bbox"))
                match = None
                if embedding is not None and enrolled_faces:
                    match = self.face.match_face(embedding, enrolled_faces)

                if match:
                    recognized_persons.append(match)
                else:
                    unknown_faces_count += 1

        # Check person roles present in this frame
        dependents_in_frame = [p for p in recognized_persons if p.get("role_type") == "dependent"]
        caregivers_in_frame = [p for p in recognized_persons if p.get("role_type") == "caregiver"]
        family_in_frame = [p for p in recognized_persons if p.get("role_type") == "family"]

        # Track anomalies triggered in this cycle
        triggered_rules = []
        snapshot_filename = None

        # -------------------------------------------------------------
        # RULE 1: UNKNOWN_VISITOR
        # -------------------------------------------------------------
        if unknown_faces_count > 0:
            triggered_rules.append("UNKNOWN_VISITOR")
            logger.warning(f"RULE TRIGGERED: UNKNOWN_VISITOR in {room_device} ({unknown_faces_count} unknown face(s))")

            blurred_bytes = self.face.blur_faces(image_bytes, face_bboxes)
            timestamp_ms = int(now.timestamp() * 1000)
            snapshot_filename = f"snapshot_unknown_{timestamp_ms}.jpg"
            saved_path = self.storage.save_snapshot(blurred_bytes, snapshot_filename)

            event_data = {
                "event_type": "UNKNOWN_VISITOR",
                "room_device": room_device,
                "severity": "high",
                "snapshot_path": saved_path,
                "details_json": {
                    "unknown_count": unknown_faces_count,
                    "recognized": [p["name"] for p in recognized_persons],
                    "total_faces": len(detected_faces)
                },
                "created_at": now
            }
            self.events.add_event(event_data)
            self.alerts.send_alert(
                event_type="UNKNOWN_VISITOR",
                severity="high",
                message=f"Unrecognized visitor detected in {room_device} ({unknown_faces_count} unknown face)",
                room_device=room_device,
                details=event_data["details_json"]
            )

        # -------------------------------------------------------------
        # RULE 2: CAREGIVER PRESENCE TRACKING
        # -------------------------------------------------------------
        if caregivers_in_frame:
            caregiver = caregivers_in_frame[0]
            cg_name = caregiver["name"]
            cg_id = caregiver.get("id")

            # Check if this is a new check-in or arrival
            if state.last_caregiver_seen is None or (now - state.last_caregiver_seen).total_seconds() > 300:
                logger.info(f"Caregiver {cg_name} checked in to {room_device}")
                # Log arrival event
                self.events.add_event({
                    "event_type": "CAREGIVER_PRESENT",
                    "room_device": room_device,
                    "severity": "low",
                    "snapshot_path": None,
                    "details_json": {"caregiver_name": cg_name, "caregiver_id": cg_id},
                    "created_at": now
                })
                state.current_caregiver_session_start = now

            # Accumulate presence duration
            if state.current_caregiver_session_start:
                session_duration = int((now - state.current_caregiver_session_start).total_seconds())
                session_duration = max(4, session_duration)
                state.total_presence_seconds += 4
                self.events.log_presence(
                    caregiver_name=cg_name,
                    caregiver_person_id=cg_id,
                    room_device=room_device,
                    duration_seconds=session_duration
                )

            state.last_caregiver_seen = now
            state.last_caregiver_name = cg_name
            state.last_caregiver_id = cg_id
            state.dependent_alone_since = None  # Reset unattended timer

        elif family_in_frame:
            # If family member is present, dependent is also attended
            state.dependent_alone_since = None

        # -------------------------------------------------------------
        # RULE 3: DEPENDENT_UNATTENDED
        # -------------------------------------------------------------
        if dependents_in_frame:
            dep = dependents_in_frame[0]
            state.last_dependent_seen = now
            state.last_dependent_name = dep["name"]

            # If no caregiver and no family member in this frame:
            if not caregivers_in_frame and not family_in_frame:
                if state.dependent_alone_since is None:
                    # If caregiver was seen previously in this room, measure from caregiver last seen
                    if state.last_caregiver_seen:
                        state.dependent_alone_since = state.last_caregiver_seen
                    else:
                        state.dependent_alone_since = now

                minutes_unattended = (now - state.dependent_alone_since).total_seconds() / 60.0

                if minutes_unattended >= self.unattended_threshold:
                    # Check alert cooldown to prevent notification fatigue
                    can_alert = True
                    if state.last_unattended_alert_time:
                        elapsed_since_last_alert = (now - state.last_unattended_alert_time).total_seconds() / 60.0
                        if elapsed_since_last_alert < self.unattended_alert_cooldown_minutes:
                            can_alert = False

                    if can_alert:
                        triggered_rules.append("DEPENDENT_UNATTENDED")
                        logger.warning(
                            f"RULE TRIGGERED: DEPENDENT_UNATTENDED in {room_device} - "
                            f"{dep['name']} unattended for {minutes_unattended:.1f} mins (threshold: {self.unattended_threshold})"
                        )

                        blurred_bytes = self.face.blur_faces(image_bytes, face_bboxes)
                        timestamp_ms = int(now.timestamp() * 1000)
                        unattended_snapshot = f"snapshot_unattended_{timestamp_ms}.jpg"
                        saved_path = self.storage.save_snapshot(blurred_bytes, unattended_snapshot)
                        snapshot_filename = snapshot_filename or unattended_snapshot

                        event_data = {
                            "event_type": "DEPENDENT_UNATTENDED",
                            "room_device": room_device,
                            "severity": "high",
                            "snapshot_path": saved_path,
                            "details_json": {
                                "dependent_name": dep["name"],
                                "minutes_unattended": round(minutes_unattended, 1),
                                "threshold_minutes": self.unattended_threshold,
                                "last_caregiver_seen": state.last_caregiver_seen.isoformat() if state.last_caregiver_seen else "Never"
                            },
                            "created_at": now
                        }
                        self.events.add_event(event_data)
                        self.alerts.send_alert(
                            event_type="DEPENDENT_UNATTENDED",
                            severity="high",
                            message=f"Alert: Dependent {dep['name']} left unattended for {int(minutes_unattended)} minutes in {room_device}!",
                            room_device=room_device,
                            details=event_data["details_json"]
                        )
                        state.last_unattended_alert_time = now

        return {
            "processed": True,
            "room_device": room_device,
            "motion_detected": motion_detected,
            "faces_detected": len(detected_faces),
            "recognized_persons": recognized_persons,
            "unknown_faces_count": unknown_faces_count,
            "dependents_count": len(dependents_in_frame),
            "caregivers_count": len(caregivers_in_frame),
            "triggered_rules": triggered_rules,
            "snapshot_path": snapshot_filename,
            "room_telemetry": {
                "last_caregiver_seen": state.last_caregiver_seen.isoformat() if state.last_caregiver_seen else None,
                "last_dependent_seen": state.last_dependent_seen.isoformat() if state.last_dependent_seen else None,
                "total_presence_seconds": state.total_presence_seconds
            }
        }

    def process_audio_distress(
        self,
        room_device: str,
        sound_class: str,
        confidence: float
    ) -> Dict[str, Any]:
        """
        Processes a browser YAMNet distress event (no raw audio received).
        """
        now = datetime.now(timezone.utc)
        message = f"Audio distress alert detected ({sound_class}, confidence: {confidence:.2f})"
        event_data = {
            "event_type": "DISTRESS_SOUND",
            "room_device": room_device,
            "severity": "critical" if confidence > 0.8 else "high",
            "snapshot_path": None,
            "details_json": {
                "sound_class": sound_class,
                "confidence": confidence
            },
            "created_at": now
        }
        stored = self.events.add_event(event_data)
        self.alerts.send_alert(
            event_type="DISTRESS_SOUND",
            severity=event_data["severity"],
            message=message,
            room_device=room_device,
            details=event_data["details_json"]
        )
        return stored
