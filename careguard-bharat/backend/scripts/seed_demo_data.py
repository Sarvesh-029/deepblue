"""
seed_demo_data.py
─────────────────
Populates the database with one demo family account and three enrolled persons
(Dependent, Caregiver with shift, Family member) plus 15 synthetic safety events
spread across the last 24 hours.

Usage (from careguard-bharat/backend/):
    python scripts/seed_demo_data.py

The script is idempotent: running it twice will not create duplicate rows.
"""

import sys
import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

# ── Make "app" importable from the scripts/ folder ───────────────────────────
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.models.user import User
from app.models.person import Person
from app.models.event import EventRecord, PresenceLog

# ── Demo credentials (shown on the README and Login page) ────────────────────
DEMO_EMAIL    = "demo@careguard.in"
DEMO_PASSWORD = "demo123"
DEMO_NAME     = "Priya Sharma (Demo Family)"

# ── Three persons to enroll ───────────────────────────────────────────────────
DEMO_PERSONS = [
    {
        "name": "Dadi",
        "role_type": "dependent",
        "shift_start": None,
        "shift_end": None,
        "notes": "Elderly dependent, requires afternoon medication reminder.",
    },
    {
        "name": "Ramesh (Ayah)",
        "role_type": "caregiver",
        "shift_start": "09:00",
        "shift_end": "18:00",
        "notes": "Primary daytime caregiver. Shift Mon–Sat.",
    },
    {
        "name": "Priya (Family)",
        "role_type": "family",
        "shift_start": None,
        "shift_end": None,
        "notes": "Family member enrolled for recognition.",
    },
]

# ── Synthetic events (type, severity, room, has_snapshot) ────────────────────
EVENT_TEMPLATES = [
    ("UNKNOWN_VISITOR",      "high",     "Living Room",  True),
    ("UNKNOWN_VISITOR",      "critical", "Front Door",   True),
    ("DEPENDENT_UNATTENDED", "high",     "Bedroom",      True),
    ("DEPENDENT_UNATTENDED", "medium",   "Living Room",  False),
    ("DISTRESS_SOUND",       "critical", "Bedroom",      False),
    ("DISTRESS_SOUND",       "high",     "Kitchen",      False),
    ("CAREGIVER_ABSENT",     "high",     "Living Room",  False),
    ("CAREGIVER_ABSENT",     "medium",   "Bedroom",      False),
    ("CAREGIVER_PRESENT",    "low",      "Living Room",  False),
    ("CAREGIVER_PRESENT",    "low",      "Bedroom",      False),
    ("UNKNOWN_VISITOR",      "high",     "Backyard",     True),
    ("DEPENDENT_UNATTENDED", "high",     "Bathroom",     False),
    ("DISTRESS_SOUND",       "medium",   "Living Room",  False),
    ("CAREGIVER_PRESENT",    "low",      "Kitchen",      False),
    ("UNKNOWN_VISITOR",      "medium",   "Front Door",   True),
]

# Details JSON per event type
def _details(etype: str) -> str:
    if etype == "UNKNOWN_VISITOR":
        return json.dumps({"confidence": round(random.uniform(0.80, 0.97), 3), "face_count": 1})
    if etype == "DEPENDENT_UNATTENDED":
        mins = random.randint(11, 25)
        return json.dumps({"unattended_minutes": mins, "threshold_minutes": 10})
    if etype == "DISTRESS_SOUND":
        label = random.choice(["Baby cry", "Scream", "Shout"])
        return json.dumps({"yamnet_class": label, "confidence": round(random.uniform(0.75, 0.96), 3)})
    if etype == "CAREGIVER_ABSENT":
        return json.dumps({"shift_start": "09:00", "minutes_late": random.randint(31, 55)})
    if etype == "CAREGIVER_PRESENT":
        return json.dumps({"caregiver": "Ramesh (Ayah)", "duration_minutes": random.randint(5, 60)})
    return "{}"


def _fake_snapshot_path(room: str) -> str:
    """Return a plausible snapshot path string (file need not exist for demo)."""
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    slug = room.lower().replace(" ", "_")
    return f"demo_{slug}_{ts}_{random.randint(1000, 9999)}.jpg"


def run():
    # ── Ensure all tables exist ───────────────────────────────────────────────
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # ── 1. Create demo user (idempotent) ─────────────────────────────────
        demo_user = db.query(User).filter(User.email == DEMO_EMAIL).first()
        if demo_user:
            print(f"[seed] Demo user already exists (id={demo_user.id}). Skipping user creation.")
        else:
            demo_user = User(
                email=DEMO_EMAIL,
                hashed_password=get_password_hash(DEMO_PASSWORD),
                full_name=DEMO_NAME,
                role="family",
                is_active=True,
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)
            print(f"[seed] Created demo user: {DEMO_EMAIL} / {DEMO_PASSWORD}  (id={demo_user.id})")

        # ── 2. Enroll persons (idempotent — check by name + family_id) ───────
        existing_names = {p.name for p in db.query(Person).filter(Person.family_id == demo_user.id).all()}
        now = datetime.now(timezone.utc)

        for pdata in DEMO_PERSONS:
            if pdata["name"] in existing_names:
                print(f"[seed] Person '{pdata['name']}' already enrolled. Skipping.")
                continue

            # Seed a fake 128-d embedding (zeros are fine for demo — no real face image needed)
            fake_embedding = json.dumps([0.0] * 128)

            person = Person(
                family_id=demo_user.id,
                name=pdata["name"],
                role_type=pdata["role_type"],
                consent_given=True,
                consent_timestamp=now,
                consent_signed_by=DEMO_NAME,
                face_embedding=fake_embedding,
                shift_start=pdata["shift_start"],
                shift_end=pdata["shift_end"],
                notes=pdata["notes"],
            )
            db.add(person)
            print(f"[seed] Enrolled person: {pdata['name']} ({pdata['role_type']})")

        db.commit()

        # ── 3. Seed synthetic events (always adds fresh events for demo) ──────
        base_time = datetime.now(timezone.utc)

        for i, (etype, severity, room, has_snap) in enumerate(EVENT_TEMPLATES):
            # Spread events across the past 23 hours, newest first
            offset_minutes = i * 90 + random.randint(0, 30)
            created = base_time - timedelta(minutes=offset_minutes)

            event = EventRecord(
                event_type=etype,
                room_device=room,
                severity=severity,
                snapshot_path=_fake_snapshot_path(room) if has_snap else None,
                details_json=_details(etype),
                created_at=created,
            )
            db.add(event)

        db.commit()
        print(f"[seed] Inserted {len(EVENT_TEMPLATES)} synthetic safety events.")

        # ── 4. Seed caregiver presence logs ──────────────────────────────────
        for _ in range(4):
            start = base_time - timedelta(hours=random.randint(1, 8))
            duration = random.randint(900, 5400)   # 15 min – 90 min in seconds
            pl = PresenceLog(
                caregiver_name="Ramesh (Ayah)",
                caregiver_person_id=None,
                room_device=random.choice(["Living Room", "Bedroom"]),
                session_start=start,
                session_end=start + timedelta(seconds=duration),
                duration_seconds=duration,
                created_at=start,
            )
            db.add(pl)

        db.commit()
        print("[seed] Inserted 4 synthetic caregiver presence log entries.")

        # ── Summary ──────────────────────────────────────────────────────────
        print("\n" + "─" * 55)
        print("  CareGuard Bharat — Demo Data Seeded Successfully")
        print("─" * 55)
        print(f"  Login:    {DEMO_EMAIL}")
        print(f"  Password: {DEMO_PASSWORD}")
        print(f"  Persons:  {len(DEMO_PERSONS)} enrolled")
        print(f"  Events:   {len(EVENT_TEMPLATES)} synthetic safety events")
        print("─" * 55)
        print("  Start the backend: uvicorn app.main:app --reload --port 8000")
        print("  Open the app:      http://localhost:5173")
        print("─" * 55 + "\n")

    finally:
        db.close()


if __name__ == "__main__":
    run()
