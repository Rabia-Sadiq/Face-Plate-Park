"""
Detection Service — updated to use best.pt via YOLODetector
"""
import json, os
import numpy as np
from typing import Optional
from app.services.yolo_detection import YOLODetector

# Singleton
_detector: Optional[YOLODetector] = None

def _get_detector() -> YOLODetector:
    global _detector
    if _detector is None:
        _detector = YOLODetector()
    return _detector


def decode_image(image_bytes: bytes) -> np.ndarray:
    import cv2
    nparr = np.frombuffer(image_bytes, np.uint8)
    return cv2.imdecode(nparr, cv2.IMREAD_COLOR)


def detect_license_plate(image_bytes: bytes) -> Optional[str]:
    """Detect license plate text using YOLO + OCR."""
    frame = decode_image(image_bytes)
    det   = _get_detector()
    results = det.detect(frame)
    if results["plates"]:
        # Return highest-confidence plate
        best = max(results["plates"], key=lambda x: x["confidence"])
        return best["text"]
    return None


def detect_and_encode_face(image_bytes: bytes) -> Optional[list]:
    """
    Detect face using YOLO, then encode using face_recognition if available.
    Falls back to returning a dummy encoding if face_recognition not installed.
    """
    frame = decode_image(image_bytes)
    det   = _get_detector()
    results = det.detect(frame)

    if not results["faces"]:
        return None

    # Try face_recognition for proper encoding
    try:
        import face_recognition, io
        img = face_recognition.load_image_file(io.BytesIO(image_bytes))
        encs = face_recognition.face_encodings(img)
        return encs[0].tolist() if encs else None
    except ImportError:
        # face_recognition not installed — return bbox as stub encoding
        best = max(results["faces"], key=lambda x: x["confidence"])
        bbox = best["bbox"]  # [x1,y1,x2,y2]
        # Return normalized bbox as minimal encoding (placeholder)
        h, w = frame.shape[:2]
        return [bbox[0]/w, bbox[1]/h, bbox[2]/w, bbox[3]/h]


def compare_faces(stored_encoding_json: str, live_encoding: list) -> float:
    """Compare face encodings. Uses face_recognition if available."""
    if not stored_encoding_json or not live_encoding:
        return 0.0

    try:
        import face_recognition
        stored = [np.array(json.loads(stored_encoding_json))]
        dist   = face_recognition.face_distance(stored, np.array(live_encoding))[0]
        return float(1 - dist)
    except ImportError:
        # Cosine similarity fallback
        stored = np.array(json.loads(stored_encoding_json))
        live   = np.array(live_encoding)
        dot    = np.dot(stored, live)
        norm   = np.linalg.norm(stored) * np.linalg.norm(live)
        return float(dot / norm) if norm > 0 else 0.0


FACE_MATCH_THRESHOLD  = float(os.getenv("FACE_THRESHOLD",  "0.60"))
PLATE_MATCH_THRESHOLD = float(os.getenv("PLATE_THRESHOLD", "0.90"))