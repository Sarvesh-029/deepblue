import smtplib
import logging
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List
from collections import deque
from app.adapters.alerts.interface import AlertService
from app.core.config import settings

logger = logging.getLogger(__name__)


class LocalAlertService(AlertService):
    """
    Local implementation of AlertService.
    Always maintains an in-app ring buffer of alerts for family dashboard.
    Optionally delivers email notifications if SMTP credentials are provided in .env.
    """

    def __init__(self, buffer_size: int = 100):
        # In-memory in-app alerts queue
        self._alerts_queue = deque(maxlen=buffer_size)

    def send_alert(
        self,
        event_type: str,
        severity: str,
        message: str,
        room_device: str,
        details: Dict[str, Any]
    ) -> bool:
        alert_payload = {
            "id": f"alert-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            "event_type": event_type,
            "severity": severity,
            "message": message,
            "room_device": room_device,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "details": details
        }
        self._alerts_queue.appendleft(alert_payload)
        logger.info(f"InApp Alert Queued: [{severity.upper()}] {event_type} - {message} ({room_device})")

        # Optional SMTP dispatch
        if settings.SMTP_HOST and settings.ALERT_EMAIL_TO:
            self._send_smtp_email(alert_payload)

        return True

    def get_recent_alerts(self, limit: int = 50) -> List[Dict[str, Any]]:
        return list(self._alerts_queue)[:limit]

    def _send_smtp_email(self, alert_payload: Dict[str, Any]):
        try:
            msg = MIMEMultipart()
            msg["From"] = settings.ALERT_EMAIL_FROM or settings.SMTP_USER
            msg["To"] = settings.ALERT_EMAIL_TO
            msg["Subject"] = f"[{settings.APP_NAME} Alert] {alert_payload['event_type']} ({alert_payload['severity'].upper()})"

            body = (
                f"CareGuard Bharat Security Alert\n\n"
                f"Event: {alert_payload['event_type']}\n"
                f"Severity: {alert_payload['severity'].upper()}\n"
                f"Room/Device: {alert_payload['room_device']}\n"
                f"Time: {alert_payload['timestamp']}\n"
                f"Details: {alert_payload['message']}\n"
            )
            msg.attach(MIMEText(body, "plain"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
            logger.info(f"Alert email sent to {settings.ALERT_EMAIL_TO}")
        except Exception as e:
            logger.error(f"Failed to send alert email: {e}")
