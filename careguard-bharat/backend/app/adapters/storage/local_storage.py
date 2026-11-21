import os
import time
from pathlib import Path
from typing import Optional
import logging
from app.adapters.storage.interface import SnapshotStorage
from app.core.config import settings

logger = logging.getLogger(__name__)


class LocalStorage(SnapshotStorage):
    """
    Local filesystem implementation of SnapshotStorage.
    Never stores raw video or raw audio - only blurred snapshot frames.
    """

    def __init__(self, base_dir: Optional[str] = None):
        target = base_dir or settings.LOCAL_SNAPSHOT_DIR
        # Anchor to backend directory if relative path
        if not Path(target).is_absolute():
            backend_root = Path(__file__).resolve().parent.parent.parent.parent
            self.base_dir = (backend_root / target).resolve()
        else:
            self.base_dir = Path(target).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save_snapshot(self, image_bytes: bytes, filename: str) -> str:
        # Sanitize filename
        safe_filename = Path(filename).name
        target_path = self.base_dir / safe_filename
        with open(target_path, "wb") as f:
            f.write(image_bytes)
        # Return path relative to base or filename
        return safe_filename

    def get_snapshot(self, relative_path: str) -> Optional[bytes]:
        safe_path = self.base_dir / Path(relative_path).name
        if safe_path.exists() and safe_path.is_file():
            with open(safe_path, "rb") as f:
                return f.read()
        return None

    def delete_snapshot(self, relative_path: str) -> bool:
        safe_path = self.base_dir / Path(relative_path).name
        if safe_path.exists() and safe_path.is_file():
            try:
                os.remove(safe_path)
                return True
            except OSError as e:
                logger.error(f"Error deleting snapshot {safe_path}: {e}")
                return False
        return False

    def delete_older_than(self, days: int = 7) -> int:
        now = time.time()
        cutoff_seconds = days * 86400
        deleted_count = 0

        for file in self.base_dir.glob("*"):
            if file.is_file():
                try:
                    file_age = now - os.path.getmtime(file)
                    if file_age > cutoff_seconds:
                        os.remove(file)
                        deleted_count += 1
                except Exception as e:
                    logger.warning(f"Failed to check/remove aged file {file}: {e}")

        logger.info(f"LocalStorage: cleaned up {deleted_count} snapshots older than {days} days.")
        return deleted_count
