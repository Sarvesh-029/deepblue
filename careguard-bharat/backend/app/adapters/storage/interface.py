from abc import ABC, abstractmethod
from typing import Optional


class SnapshotStorage(ABC):
    """
    Abstract interface for Snapshot Storage.
    LocalStorage saves blurred snapshots to local filesystem.
    Future S3Storage adapter implements this exact interface.
    """

    @abstractmethod
    def save_snapshot(self, image_bytes: bytes, filename: str) -> str:
        """
        Saves snapshot bytes and returns a storage path/URL.
        """
        pass

    @abstractmethod
    def get_snapshot(self, relative_path: str) -> Optional[bytes]:
        """
        Retrieves snapshot bytes by path.
        """
        pass

    @abstractmethod
    def delete_snapshot(self, relative_path: str) -> bool:
        """
        Deletes a snapshot file by path.
        """
        pass

    @abstractmethod
    def delete_older_than(self, days: int = 7) -> int:
        """
        Deletes snapshots older than specified days (Privacy compliance).
        Returns count of deleted files.
        """
        pass
