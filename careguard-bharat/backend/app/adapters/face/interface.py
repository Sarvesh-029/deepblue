from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional, Tuple
import numpy as np


class FaceService(ABC):
    """
    Abstract interface for Face Detection and Recognition.
    LocalFaceService uses OpenCV YuNet + SFace.
    Future AWS Rekognition adapter implements this exact interface.
    """

    @abstractmethod
    def detect_faces(self, image_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Detects faces in the given image.
        Returns a list of dicts:
        [{
            'bbox': [x, y, w, h],
            'confidence': float,
            'landmarks': list
        }, ...]
        """
        pass

    @abstractmethod
    def extract_embedding(self, image_bytes: bytes, face_bbox: Optional[List[int]] = None) -> Optional[np.ndarray]:
        """
        Extracts a feature embedding vector for a face.
        """
        pass

    @abstractmethod
    def match_face(
        self,
        embedding: np.ndarray,
        enrolled_faces: List[Dict[str, Any]],
        threshold: float = 0.363
    ) -> Optional[Dict[str, Any]]:
        """
        Matches a given embedding against a list of enrolled face dictionaries:
        enrolled_faces format: [{'id': 1, 'name': 'Dadi', 'role_type': 'dependent', 'embedding': np.ndarray}, ...]
        Returns matched face info with cosine/L2 distance or None if unknown.
        """
        pass

    @abstractmethod
    def blur_faces(self, image_bytes: bytes, face_bboxes: List[List[int]]) -> bytes:
        """
        Applies privacy-preserving Gaussian blur over all detected faces.
        Returns the blurred image as JPEG/PNG bytes.
        """
        pass
