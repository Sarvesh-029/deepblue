from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from app.core.config import settings
from app.adapters.face.interface import FaceService
from app.adapters.storage.interface import SnapshotStorage
from app.adapters.alerts.interface import AlertService
from app.adapters.events.interface import EventStore
from app.api.deps import (
    get_face_svc,
    get_storage_svc,
    get_alert_svc,
    get_event_svc
)

router = APIRouter(tags=["System Status"])


@router.get("/health")
def health_check(
    face_svc: FaceService = Depends(get_face_svc),
    storage_svc: SnapshotStorage = Depends(get_storage_svc),
    alert_svc: AlertService = Depends(get_alert_svc),
    event_store: EventStore = Depends(get_event_svc)
):
    """
    Health check endpoint exposing system info and active adapter implementations.
    Shows cloud readiness status without exposing private secrets.
    """
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "active_adapters": {
            "face_service": type(face_svc).__name__,
            "snapshot_storage": type(storage_svc).__name__,
            "alert_service": type(alert_svc).__name__,
            "event_store": type(event_store).__name__,
        },
        "privacy_compliance": {
            "store_raw_video": False,
            "store_raw_audio": False,
            "blur_stored_snapshots": True,
            "auto_retention_days": settings.SNAPSHOT_RETENTION_DAYS,
            "consent_required_before_enrollment": True
        }
    }


@router.get("/status")
def system_status(
    alert_svc: AlertService = Depends(get_alert_svc),
    event_store: EventStore = Depends(get_event_svc)
):
    recent_events = event_store.list_events(limit=5)
    recent_alerts = alert_svc.get_recent_alerts(limit=5)
    return {
        "recent_events_count": len(recent_events),
        "recent_alerts_count": len(recent_alerts),
        "latest_event": recent_events[0] if recent_events else None
    }
