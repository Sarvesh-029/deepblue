from functools import lru_cache
from app.core.config import settings
from app.adapters.face.interface import FaceService
from app.adapters.face.local_face import LocalFaceService
from app.adapters.storage.interface import SnapshotStorage
from app.adapters.storage.local_storage import LocalStorage
from app.adapters.alerts.interface import AlertService
from app.adapters.alerts.local_alert import LocalAlertService
from app.adapters.events.interface import EventStore
from app.adapters.events.sqlite_events import SQLiteEventStore


@lru_cache()
def get_face_service() -> FaceService:
    """
    Factory returning configured FaceService.
    Swappable to AWS Rekognition via settings.FACE_SERVICE_BACKEND.
    """
    if settings.FACE_SERVICE_BACKEND == "rekognition":
        # Cloud migration hook: return RekognitionFaceService()
        raise NotImplementedError("AWS Rekognition adapter configured for future cloud migration.")
    return LocalFaceService()


@lru_cache()
def get_storage_service() -> SnapshotStorage:
    """
    Factory returning configured SnapshotStorage.
    Swappable to S3Storage via settings.STORAGE_BACKEND.
    """
    if settings.STORAGE_BACKEND == "s3":
        # Cloud migration hook: return S3SnapshotStorage()
        raise NotImplementedError("AWS S3 adapter configured for future cloud migration.")
    return LocalStorage()


@lru_cache()
def get_alert_service() -> AlertService:
    """
    Factory returning configured AlertService.
    Swappable to SNSService via settings.ALERT_BACKEND.
    """
    if settings.ALERT_BACKEND == "sns":
        # Cloud migration hook: return SNSAlertService()
        raise NotImplementedError("AWS SNS alert adapter configured for future cloud migration.")
    return LocalAlertService()


@lru_cache()
def get_event_store() -> EventStore:
    """
    Factory returning configured EventStore.
    Swappable to DynamoDBEventStore via settings.EVENT_STORE_BACKEND.
    """
    if settings.EVENT_STORE_BACKEND == "dynamodb":
        # Cloud migration hook: return DynamoDBEventStore()
        raise NotImplementedError("AWS DynamoDB event adapter configured for future cloud migration.")
    return SQLiteEventStore()


__all__ = [
    "FaceService",
    "LocalFaceService",
    "SnapshotStorage",
    "LocalStorage",
    "AlertService",
    "LocalAlertService",
    "EventStore",
    "SQLiteEventStore",
    "get_face_service",
    "get_storage_service",
    "get_alert_service",
    "get_event_store",
]
