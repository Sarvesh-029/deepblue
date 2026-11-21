import os
import io
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np
from app.adapters.face.interface import FaceService
from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    import cv2
except ImportError:
    cv2 = None
    logger.warning("OpenCV is not installed yet. LocalFaceService will run in mock/standby mode.")


class LocalFaceService(FaceService):
    """
    Local implementation of FaceService using OpenCV's built-in YuNet (FaceDetectorYN)
    and SFace (FaceRecognizerSF) ONNX models.
    Lightweight, runs on Windows CPU, no dlib or heavy C++ binaries needed.
    """

    def __init__(
        self,
        yunet_path: Optional[str] = None,
        sface_path: Optional[str] = None,
        score_threshold: float = 0.8,
        nms_threshold: float = 0.3
    ):
        self.yunet_path = yunet_path or settings.YUNET_MODEL_PATH
        self.sface_path = sface_path or settings.SFACE_MODEL_PATH
        self.score_threshold = score_threshold
        self.nms_threshold = nms_threshold
        
        self.detector = None
        self.recognizer = None
        self._load_models_if_available()

    def _resolve_model_path(self, model_name: str, candidate_path: str) -> str:
        candidates = [
            Path(candidate_path),
            Path(__file__).resolve().parent.parent.parent.parent / "models_data" / model_name,
            Path("models_data") / model_name,
            Path("backend/models_data") / model_name,
            Path("careguard-bharat/backend/models_data") / model_name
        ]
        for c in candidates:
            if c.exists() and c.is_file() and c.stat().st_size > 50000:
                return str(c.resolve())
        return candidate_path

    def _load_models_if_available(self):
        if cv2 is None:
            return

        resolved_yunet = self._resolve_model_path("face_detection_yunet_2023mar.onnx", self.yunet_path)
        resolved_sface = self._resolve_model_path("face_recognition_sface_2021dec.onnx", self.sface_path)

        if os.path.exists(resolved_yunet) and os.path.exists(resolved_sface):
            try:
                # Initialize YuNet with default input size (320, 320), dynamically updated on inference
                self.detector = cv2.FaceDetectorYN.create(
                    model=resolved_yunet,
                    config="",
                    input_size=(320, 320),
                    score_threshold=self.score_threshold,
                    nms_threshold=self.nms_threshold,
                    top_k=5000
                )
                self.recognizer = cv2.FaceRecognizerSF.create(
                    model=resolved_sface,
                    config=""
                )
                self.yunet_path = resolved_yunet
                self.sface_path = resolved_sface
                logger.info(f"LocalFaceService: YuNet and SFace models loaded successfully from {resolved_yunet}")
            except Exception as e:
                logger.error(f"Failed to load OpenCV ONNX models: {e}")
        else:
            logger.info(
                f"Face models not found on disk ({resolved_yunet}, {resolved_sface}). "
                "Run scripts/download_models.py to download them in Stage 3."
            )

    def _decode_image(self, image_bytes: bytes) -> Optional[np.ndarray]:
        if cv2 is None:
            return None
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img

    def detect_faces(self, image_bytes: bytes) -> List[Dict[str, Any]]:
        img = self._decode_image(image_bytes)
        if img is None:
            return []

        h, w, _ = img.shape
        if self.detector is None:
            self._load_models_if_available()

        if self.detector is None:
            # Standby mode before models are downloaded
            return []

        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(img)
        
        results = []
        if faces is not None:
            for face in faces:
                bbox = [int(face[0]), int(face[1]), int(face[2]), int(face[3])]
                confidence = float(face[-1])
                landmarks = face[4:14].reshape((5, 2)).tolist()
                results.append({
                    "bbox": bbox,
                    "confidence": confidence,
                    "landmarks": landmarks,
                    "raw_face": face
                })
        return results

    def extract_embedding(self, image_bytes: bytes, face_bbox: Optional[List[int]] = None) -> Optional[np.ndarray]:
        img = self._decode_image(image_bytes)
        if img is None or self.recognizer is None:
            return None

        faces = self.detect_faces(image_bytes)
        if not faces:
            return None

        # Take first or best face
        raw_face = faces[0]["raw_face"]
        aligned_face = self.recognizer.alignCrop(img, raw_face)
        feature = self.recognizer.feature(aligned_face)
        return feature.flatten()

    def match_face(
        self,
        embedding: np.ndarray,
        enrolled_faces: List[Dict[str, Any]],
        threshold: float = 0.363  # SFace cosine similarity threshold: >= 0.363 is same person
    ) -> Optional[Dict[str, Any]]:
        if self.recognizer is None or embedding is None:
            return None

        best_match = None
        highest_similarity = -1.0

        for enrolled in enrolled_faces:
            target_feat = enrolled.get("embedding")
            if target_feat is None:
                continue
            if isinstance(target_feat, (str, list)):
                target_feat = np.array(json.loads(target_feat) if isinstance(target_feat, str) else target_feat, dtype=np.float32)

            feat1 = embedding.reshape(1, -1)
            feat2 = target_feat.reshape(1, -1)
            similarity = self.recognizer.match(feat1, feat2, cv2.FaceRecognizerSF_FR_COSINE)

            if similarity > highest_similarity:
                highest_similarity = similarity
                if similarity >= threshold:
                    best_match = {
                        "id": enrolled.get("id"),
                        "name": enrolled.get("name"),
                        "role_type": enrolled.get("role_type"),
                        "similarity": float(similarity)
                    }

        return best_match

    def blur_faces(self, image_bytes: bytes, face_bboxes: List[List[int]]) -> bytes:
        img = self._decode_image(image_bytes)
        if img is None or cv2 is None:
            return image_bytes

        h, w, _ = img.shape
        for bbox in face_bboxes:
            bx, by, bw, bh = bbox
            x1, y1 = max(0, bx), max(0, by)
            x2, y2 = min(w, bx + bw), min(h, by + bh)
            
            if x2 > x1 and y2 > y1:
                roi = img[y1:y2, x1:x2]
                # Heavy Gaussian blur for privacy
                ksize = max(15, (roi.shape[1] // 3) | 1)
                blurred_roi = cv2.GaussianBlur(roi, (ksize, ksize), 30)
                img[y1:y2, x1:x2] = blurred_roi

        _, buffer = cv2.imencode(".jpg", img, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        return buffer.tobytes()
