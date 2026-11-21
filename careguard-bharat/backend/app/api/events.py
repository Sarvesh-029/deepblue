from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException
from pydantic import BaseModel, Field
from app.api.deps import get_current_user, get_event_svc, get_rule_engine
from app.models.user import User
from app.adapters.events.interface import EventStore
from app.rules.engine import RuleEngine

router = APIRouter(prefix="/events", tags=["Safety Events & Rules"])


class RuleConfigRequest(BaseModel):
    unattended_minutes: int = Field(..., ge=1, le=120, description="Minutes before dependent is considered unattended")


@router.get("/stats")
def get_dashboard_event_stats(
    current_user: User = Depends(get_current_user),
    event_store: EventStore = Depends(get_event_svc)
):
    """
    Returns aggregated metrics for dashboard summary widgets.
    """
    events = event_store.list_events(limit=200)
    presence_logs = event_store.get_recent_presence(minutes=1440)

    severity_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    type_counts = {
        "UNKNOWN_VISITOR": 0,
        "DEPENDENT_UNATTENDED": 0,
        "CAREGIVER_ABSENT": 0,
        "DISTRESS_SOUND": 0,
        "CAREGIVER_PRESENT": 0,
        "OTHER": 0
    }
    snapshots_count = 0

    for ev in events:
        sev = ev.get("severity", "medium").lower()
        if sev in severity_counts:
            severity_counts[sev] += 1
        
        etype = ev.get("event_type", "OTHER")
        if etype in type_counts:
            type_counts[etype] += 1
        else:
            type_counts["OTHER"] += 1

        if ev.get("snapshot_path"):
            snapshots_count += 1

    total_presence_seconds = sum(p["duration_seconds"] for p in presence_logs)
    total_presence_minutes = round(total_presence_seconds / 60, 1)

    return {
        "total_events": len(events),
        "total_snapshots": snapshots_count,
        "severity_counts": severity_counts,
        "type_counts": type_counts,
        "caregiver_presence_minutes": total_presence_minutes,
        "active_caregivers_count": len(set(p["caregiver_name"] for p in presence_logs))
    }


@router.get("")
def list_safety_events(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = Query(None, description="e.g. UNKNOWN_VISITOR, DEPENDENT_UNATTENDED, CAREGIVER_PRESENT"),
    room_device: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    event_store: EventStore = Depends(get_event_svc)
):
    """
    Retrieves safety events recorded by the Rules Engine.
    Only authenticated family members can view events (Privacy guarantee).
    """
    events = event_store.list_events(
        limit=limit,
        offset=offset,
        event_type=event_type,
        room_device=room_device
    )
    return {
        "count": len(events),
        "limit": limit,
        "offset": offset,
        "events": events
    }


@router.get("/presence")
def get_caregiver_presence_logs(
    minutes: int = Query(1440, description="Window in minutes (default 24h = 1440m)"),
    room_device: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    event_store: EventStore = Depends(get_event_svc)
):
    """
    Retrieves presence tracking logs for caregivers across monitored rooms.
    """
    presence_logs = event_store.get_recent_presence(
        room_device=room_device,
        minutes=minutes
    )
    
    # Calculate total duration in hours and minutes per caregiver
    summary = {}
    for p in presence_logs:
        cg = p["caregiver_name"]
        if cg not in summary:
            summary[cg] = {
                "caregiver_name": cg,
                "total_seconds": 0,
                "total_minutes": 0,
                "rooms": set(),
                "latest_activity": p["session_start"]
            }
        summary[cg]["total_seconds"] += p["duration_seconds"]
        summary[cg]["rooms"].add(p["room_device"])

    formatted_summary = []
    for k, v in summary.items():
        v["total_minutes"] = round(v["total_seconds"] / 60, 1)
        v["rooms"] = list(v["rooms"])
        formatted_summary.append(v)

    return {
        "presence_logs": presence_logs,
        "caregivers_summary": formatted_summary
    }


@router.get("/config")
def get_rules_configuration(
    current_user: User = Depends(get_current_user),
    rule_engine: RuleEngine = Depends(get_rule_engine)
):
    """
    Returns configurable threshold parameters for the rules engine.
    """
    return {
        "unattended_minutes_threshold": rule_engine.unattended_threshold,
        "cooldown_minutes": rule_engine.unattended_alert_cooldown_minutes
    }


@router.post("/config")
def update_rules_configuration(
    req: RuleConfigRequest,
    current_user: User = Depends(get_current_user),
    rule_engine: RuleEngine = Depends(get_rule_engine)
):
    """
    Updates rule evaluation parameters.
    """
    rule_engine.set_unattended_threshold(req.unattended_minutes)
    return {
        "status": "updated",
        "unattended_minutes_threshold": rule_engine.unattended_threshold
    }
