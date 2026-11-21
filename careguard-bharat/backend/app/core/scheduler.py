import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.person import Person
from app.models.event import PresenceLog, EventRecord
from app.adapters import get_storage_service, get_alert_service, get_event_store

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler: Optional[BackgroundScheduler] = None
# Cache of caregivers alerted today to prevent multiple redundant alerts
_alerted_caregivers_today = set()


def check_caregiver_shifts():
    """
    APScheduler job: runs every 5 minutes.
    Rule: CAREGIVER_ABSENT - shift started but the caregiver was not recognized within 30 minutes.
    """
    now = datetime.now(timezone.utc)
    today_str = now.strftime("%Y-%m-%d")
    current_time_str = now.strftime("%H:%M")

    try:
        with SessionLocal() as db:
            # Query all caregivers who have shift_start configured
            caregivers = db.query(Person).filter(
                Person.role_type == "caregiver",
                Person.shift_start != None
            ).all()

            alert_svc = get_alert_service()
            event_store = get_event_store()

            for cg in caregivers:
                shift_start = cg.shift_start  # Format "HH:MM", e.g. "09:00"
                if not shift_start:
                    continue

                try:
                    # Parse shift start into a today datetime object
                    sh_hour, sh_minute = map(int, shift_start.split(":"))
                    shift_dt = now.replace(hour=sh_hour, minute=sh_minute, second=0, microsecond=0)
                except Exception:
                    continue

                # Check if we are past the 30-minute grace period of shift start
                grace_period_end = shift_dt + timedelta(minutes=settings.CAREGIVER_ABSENT_CHECK_MINUTES)
                
                # Check if current time is between (shift_start + 30m) and (shift_start + 4 hours)
                if grace_period_end <= now <= (shift_dt + timedelta(hours=4)):
                    cache_key = f"{cg.id}_{today_str}_{shift_start}"
                    if cache_key in _alerted_caregivers_today:
                        continue  # Already alerted for this shift today

                    # Check if caregiver was seen in any presence log or event today around shift start
                    recent_presence = db.query(PresenceLog).filter(
                        PresenceLog.caregiver_person_id == cg.id,
                        PresenceLog.session_start >= shift_dt - timedelta(minutes=15)
                    ).first()

                    if not recent_presence:
                        # Caregiver was not recognized within 30 minutes of shift start!
                        logger.warning(
                            f"SCHEDULER ALERT: CAREGIVER_ABSENT - {cg.name} scheduled for {shift_start} "
                            f"was NOT recognized within {settings.CAREGIVER_ABSENT_CHECK_MINUTES} minutes."
                        )

                        event_data = {
                            "event_type": "CAREGIVER_ABSENT",
                            "room_device": "Home Sentinel Schedule",
                            "severity": "high",
                            "snapshot_path": None,
                            "details_json": {
                                "caregiver_name": cg.name,
                                "caregiver_id": cg.id,
                                "shift_start": shift_start,
                                "grace_period_minutes": settings.CAREGIVER_ABSENT_CHECK_MINUTES,
                                "timestamp": now.isoformat()
                            },
                            "created_at": now
                        }
                        event_store.add_event(event_data)
                        alert_svc.send_alert(
                            event_type="CAREGIVER_ABSENT",
                            severity="high",
                            message=f"Shift Alert: Caregiver {cg.name} was NOT recognized within {settings.CAREGIVER_ABSENT_CHECK_MINUTES} minutes of shift start ({shift_start})!",
                            room_device="Home Sentinel Schedule",
                            details=event_data["details_json"]
                        )
                        _alerted_caregivers_today.add(cache_key)

    except Exception as e:
        logger.error(f"Error executing check_caregiver_shifts job: {e}")


def cleanup_expired_snapshots():
    """
    APScheduler job: cleans up blurred snapshots older than 7 days.
    Privacy by design compliance.
    """
    try:
        storage = get_storage_service()
        deleted = storage.delete_older_than(days=settings.SNAPSHOT_RETENTION_DAYS)
        if deleted > 0:
            logger.info(f"SCHEDULER: Auto-purged {deleted} snapshots older than {settings.SNAPSHOT_RETENTION_DAYS} days.")
    except Exception as e:
        logger.error(f"Error executing cleanup_expired_snapshots job: {e}")


def start_scheduler():
    global scheduler
    if scheduler is not None and scheduler.running:
        return

    scheduler = BackgroundScheduler()
    
    # 1. Check caregiver shift adherence every 5 minutes
    scheduler.add_job(
        check_caregiver_shifts,
        trigger=IntervalTrigger(minutes=5),
        id="check_caregiver_shifts_job",
        name="Check Caregiver Shift Absent",
        replace_existing=True
    )

    # 2. Cleanup snapshots older than 7 days every 6 hours
    scheduler.add_job(
        cleanup_expired_snapshots,
        trigger=IntervalTrigger(hours=6),
        id="cleanup_expired_snapshots_job",
        name="Auto-purge Old Snapshots (7 Days)",
        replace_existing=True
    )

    scheduler.start()
    logger.info("CareGuard Bharat APScheduler started: Shift check (every 5m), Snapshot cleanup (7-day retention).")


def shutdown_scheduler():
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("CareGuard Bharat APScheduler shut down.")
