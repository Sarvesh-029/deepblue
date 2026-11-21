from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional


class EventStore(ABC):
    """
    Abstract interface for persisting and querying safety events and presence records.
    SQLiteEventStore implements this using local SQLAlchemy.
    Future DynamoDB adapter implements this exact interface for AWS deployment.
    """

    @abstractmethod
    def add_event(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Stores an event record:
        {
            'event_type': str,
            'room_device': str,
            'severity': str,
            'snapshot_path': Optional[str],
            'details_json': Optional[str]
        }
        """
        pass

    @abstractmethod
    def list_events(
        self,
        limit: int = 50,
        offset: int = 0,
        event_type: Optional[str] = None,
        room_device: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Lists stored events ordered by timestamp descending.
        """
        pass

    @abstractmethod
    def log_presence(
        self,
        caregiver_name: str,
        caregiver_person_id: Optional[int],
        room_device: str,
        duration_seconds: int
    ) -> Dict[str, Any]:
        """
        Records or updates presence duration of a caregiver.
        """
        pass

    @abstractmethod
    def get_recent_presence(self, room_device: Optional[str] = None, minutes: int = 60) -> List[Dict[str, Any]]:
        """
        Queries recent presence activities.
        """
        pass
