from abc import ABC, abstractmethod
from typing import Dict, Any, List


class AlertService(ABC):
    """
    Abstract interface for Dispatched Alerts.
    Local implementation provides in-app notification queue + optional SMTP.
    Future AWS SNS adapter implements this exact interface.
    """

    @abstractmethod
    def send_alert(
        self,
        event_type: str,
        severity: str,
        message: str,
        room_device: str,
        details: Dict[str, Any]
    ) -> bool:
        """
        Dispatches an alert to authorized family members.
        """
        pass

    @abstractmethod
    def get_recent_alerts(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Returns recent in-app alerts.
        """
        pass
