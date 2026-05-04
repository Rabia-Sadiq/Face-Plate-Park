"""
YOLO Detection Service
----------------------
best.pt detects BOTH face AND license plate.
EasyOCR is used only to READ the plate text from the detected plate region.
"""

import cv2
import numpy as np
import os
from typing import Optional

# -- YOLO ---------------------------------------------------------------------
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("WARNING: ultralytics not installed. Run: pip install ultralytics")

# -- EasyOCR (only for reading plate text from cropped region) ----------------
try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False
    print("INFO: easyocr not installed. Plate text will show bbox coords.")

MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "models/best.pt")

# ---------------------------------------------------------------------------
# CLASS NAME MAPPING
# Your model classes will be auto-detected and printed on startup.
# The sets below map possible class name variations to face / plate category.
# Add your model's exact class names here if they differ.
# ---------------------------------------------------------------------------
FACE_CLASS_NAMES  = {
    "face", "faces", "person_face", "head",
    "human_face", "driver", "person"
}
PLATE_CLASS_NAMES = {
    "license_plate", "licence_plate", "plate",
    "numberplate", "number_plate", "lp", "car_plate",
    "licenseplate", "licencePlate"
}


class YOLODetector:
    def __init__(self):
        self.model        = None
        self.class_names  = {}
        self._ocr_reader  = None
        self._face_ids    = set()   # class ids that are faces
        self._plate_ids   = set()   # class ids that are plates
        self._load_model()
        self._load_ocr()

    # -------------------------------------------------------------------------
    def _load_model(self):
        if not YOLO_AVAILABLE:
            print("ERROR: ultralytics not available")
            return
        if not os.path.exists(MODEL_PATH):
            print(f"ERROR: Model not found at: {MODEL_PATH}")
            print("       Copy best.pt into backend/models/ folder")
            return
        try:
            self.model       = YOLO(MODEL_PATH)
            self.class_names = self.model.names   # {0: 'face', 1: 'license_plate'}
            print(f"OK: YOLO model loaded -> {MODEL_PATH}")
            print(f"    Detected classes: {self.class_names}")

            # Build fast lookup sets
            for cls_id, cls_name in self.class_names.items():
                name_lower = cls_name.lower().strip()
                if name_lower in FACE_CLASS_NAMES:
                    self._face_ids.add(cls_id)
                    print(f"    Class {cls_id} '{cls_name}' -> FACE")
                elif name_lower in PLATE_CLASS_NAMES:
                    self._plate_ids.add(cls_id)
                    print(f"    Class {cls_id} '{cls_name}' -> PLATE")
                else:
                    print(f"    Class {cls_id} '{cls_name}' -> UNKNOWN (add to FACE/PLATE set if needed)")

        except Exception as e:
            print(f"ERROR loading model: {e}")

    # -------------------------------------------------------------------------
    def _load_ocr(self):
        if not EASYOCR_AVAILABLE:
            return
        try:
            self._ocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
            print("OK: EasyOCR ready for plate text reading")
        except Exception as e:
            print(f"ERROR loading EasyOCR: {e}")

    # -------------------------------------------------------------------------
    def detect(self, frame: np.ndarray, conf_threshold: float = 0.40) -> dict:
        """
        Run YOLO on a single BGR frame.

        Returns:
            {
              "faces":  [{"bbox":[x1,y1,x2,y2], "confidence":0.92, "text":"Face Detected"}, ...],
              "plates": [{"bbox":[x1,y1,x2,y2], "confidence":0.87, "text":"ABC-1234"}, ...]
            }
        """
        result = {"faces": [], "plates": []}

        if self.model is None:
            return result

        try:
            predictions = self.model(frame, conf=conf_threshold, verbose=False)

            for pred in predictions:
                if pred.boxes is None:
                    continue

                for box in pred.boxes:
                    cls_id     = int(box.cls[0])
                    confidence = float(box.conf[0])
                    x1, y1, x2, y2 = map(int, box.xyxy[0])

                    # -- FACE -------------------------------------------------
                    if cls_id in self._face_ids:
                        result["faces"].append({
                            "bbox":       [x1, y1, x2, y2],
                            "confidence": round(confidence, 3),
                            "class":      self.class_names.get(cls_id, "face"),
                            "text":       "Face Detected",
                        })

                    # -- PLATE ------------------------------------------------
                    elif cls_id in self._plate_ids:
                        # Crop plate region and read text with OCR
                        plate_text = self._read_plate_text(frame, x1, y1, x2, y2)
                        result["plates"].append({
                            "bbox":       [x1, y1, x2, y2],
                            "confidence": round(confidence, 3),
                            "class":      self.class_names.get(cls_id, "license_plate"),
                            "text":       plate_text,
                        })

                    # -- UNKNOWN CLASS (fallback) -----------------------------
                    else:
                        cls_name = self.class_names.get(cls_id, "unknown").lower()
                        print(f"  Unrecognized class: {cls_name} (id={cls_id}) — skipping")

        except Exception as e:
            print(f"Detection error: {e}")

        return result

    # -------------------------------------------------------------------------
    def _read_plate_text(self, frame: np.ndarray,
                         x1: int, y1: int, x2: int, y2: int) -> str:
        """Crop plate bbox and run OCR to extract text."""

        # Clamp coords to frame bounds
        h, w = frame.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)

        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            return "UNREADABLE"

        # If EasyOCR available — use it
        if self._ocr_reader is not None:
            try:
                # Preprocess: grayscale + upscale + threshold
                gray    = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
                scaled  = cv2.resize(gray, None, fx=2.5, fy=2.5,
                                     interpolation=cv2.INTER_CUBIC)
                _, thr  = cv2.threshold(scaled, 0, 255,
                                        cv2.THRESH_BINARY + cv2.THRESH_OTSU)

                results  = self._ocr_reader.readtext(
                    thr, detail=0,
                    allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-",
                )
                text = "".join(results).strip().upper().replace(" ", "")
                if len(text) >= 3:
                    return text
            except Exception as e:
                print(f"OCR error: {e}")

        # Fallback — return placeholder
        return f"PLATE_{x1}x{y1}"

    # -------------------------------------------------------------------------
    def draw_boxes(self, frame: np.ndarray, detections: dict) -> np.ndarray:
        """Draw annotated bounding boxes on frame in-place."""

        # -- Faces: green -----------------------------------------------------
        for det in detections.get("faces", []):
            x1, y1, x2, y2 = det["bbox"]
            conf  = det["confidence"]
            label = f"Face  {conf:.0%}"
            color = (0, 255, 100)

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            (tw, th), _ = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            cv2.rectangle(frame,
                          (x1, y1 - th - 10), (x1 + tw + 8, y1), color, -1)
            cv2.putText(frame, label, (x1 + 4, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

        # -- Plates: cyan (unknown) / green (matched) -------------------------
        for det in detections.get("plates", []):
            x1, y1, x2, y2 = det["bbox"]
            conf   = det["confidence"]
            text   = det.get("text", "")
            emp    = det.get("employee", "")
            access = det.get("access", False)

            color = (0, 220, 100) if access else (0, 220, 255)
            label = f"{text}" if not emp or emp == "Unknown" else f"{text} | {emp}"

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            (tw, th), _ = cv2.getTextSize(
                label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            cv2.rectangle(frame,
                          (x1, y1 - th - 10), (x1 + tw + 8, y1), color, -1)
            cv2.putText(frame, label, (x1 + 4, y1 - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

            # Access badge below box
            badge       = "GRANTED" if access else "UNKNOWN"
            badge_color = (0, 210, 80) if access else (0, 100, 255)
            cv2.putText(frame, badge, (x1 + 4, y2 + 22),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, badge_color, 2)

        return frame

    # -------------------------------------------------------------------------
    def get_class_info(self) -> dict:
        return {
            "model_path":      MODEL_PATH,
            "model_loaded":    self.model is not None,
            "classes":         self.class_names,
            "face_class_ids":  list(self._face_ids),
            "plate_class_ids": list(self._plate_ids),
            "easyocr_loaded":  self._ocr_reader is not None,
        }