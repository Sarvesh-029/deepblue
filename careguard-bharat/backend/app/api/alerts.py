from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from app.api.deps import get_current_user, get_alert_svc
from app.models.user import User
from app.adapters.alerts.interface import AlertService

router = APIRouter(prefix="/alerts", tags=["Live Dispatched Alerts"])


class TestAlertRequest(BaseModel):
    message: str = "Test security notification from CareGuard Bharat"
    room_device: str = "Living Room"
    severity: str = "high"


@router.get("")
def get_recent_alerts(
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    alert_svc: AlertService = Depends(get_alert_svc)
):
    """
    Returns recent in-app safety alerts dispatched to family members.
    """
    alerts = alert_svc.get_recent_alerts(limit=limit)
    return {
        "count": len(alerts),
        "alerts": alerts
    }


@router.post("/test")
def dispatch_test_alert(
    req: TestAlertRequest,
    current_user: User = Depends(get_current_user),
    alert_svc: AlertService = Depends(get_alert_svc)
):
    """
    Triggers a test alert to verify the in-app alert queue and optional SMTP email dispatch.
    """
    success = alert_svc.send_alert(
        event_type="TEST_ALERT",
        severity=req.severity,
        message=req.message,
        room_device=req.room_device,
        details={"triggered_by": current_user.email}
    )
    return {
        "status": "alert_dispatched" if success else "failed",
        "message": req.message,
        "room_device": req.room_device,
        "severity": req.severity
    }
