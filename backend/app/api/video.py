from fastapi import APIRouter, UploadFile, File, Form, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import cv2
import numpy as np
import json
import base64
import asyncio
import os
import uuid
import tempfile
from datetime import datetime
from typing import Optional

from app.core.database import get_db
from app.models.models import Employee, ParkingLog
from app.services.yolo_detection import YOLODetector

router = APIRouter()

# Global detector instance (loads model once)
detector: Optional[YOLODetector] = None

def get_detector() -> YOLODetector:
    global detector
    if detector is None:
        detector = YOLODetector()
    return detector


# ── Upload Video + Process ────────────────────────────────────────────────────

@router.post("/process")
async def process_video(
    video: UploadFile = File(...),
    save_detections: bool = Form(True),
    db: Session = Depends(get_db)
):
    """
    Upload a video file, run YOLO detection on every frame,
    return summary of detected faces and plates.
    """
    det = get_detector()

    # Save uploaded video to temp file
    suffix = os.path.splitext(video.filename)[1] or ".mp4"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    content = await video.read()
    tmp.write(content)
    tmp.close()

    cap = cv2.VideoCapture(tmp.name)
    if not cap.isOpened():
        os.unlink(tmp.name)
        return {"error": "Could not open video file"}

    fps        = cap.get(cv2.CAP_PROP_FPS) or 25
    total      = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    results    = []
    frame_num  = 0
    sample_every = max(1, int(fps // 2))   # process 2 frames per second

    snapshot_dir = "uploads/video_snapshots"
    os.makedirs(snapshot_dir, exist_ok=True)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_num % sample_every == 0:
            detections = det.detect(frame)

            if detections["plates"] or detections["faces"]:
                # Draw boxes on frame
                annotated = det.draw_boxes(frame.copy(), detections)

                # Save snapshot
                snap_name = f"frame_{frame_num}_{uuid.uuid4().hex[:6]}.jpg"
                snap_path = os.path.join(snapshot_dir, snap_name)
                cv2.imwrite(snap_path, annotated)

                # Try to match plates against DB
                for plate in detections["plates"]:
                    emp = db.query(Employee).filter(
                        Employee.license_plate == plate["text"].upper().strip(),
                        Employee.is_active == True
                    ).first()
                    plate["employee"] = emp.name if emp else "Unknown"
                    plate["access"]   = emp is not None

                    if save_detections:
                        log = ParkingLog(
                            employee_id=emp.employee_id if emp else None,
                            employee_name=emp.name if emp else None,
                            license_plate_detected=plate["text"],
                            face_detected=len(detections["faces"]) > 0,
                            plate_match=emp is not None,
                            access_granted=emp is not None,
                            entry_type="ENTRY",
                            snapshot_path=snap_path,
                            notes=f"Video detection — frame {frame_num}",
                        )
                        db.add(log)

                results.append({
                    "frame": frame_num,
                    "timestamp_sec": round(frame_num / fps, 2),
                    "snapshot": snap_path,
                    "plates": detections["plates"],
                    "faces":  detections["faces"],
                })

        frame_num += 1

    cap.release()
    os.unlink(tmp.name)

    if save_detections:
        db.commit()

    return {
        "total_frames":     total,
        "frames_processed": frame_num,
        "detections_found": len(results),
        "results":          results,
    }


# ── WebSocket — Webcam Live Stream ────────────────────────────────────────────

@router.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket, db: Session = Depends(get_db)):
    """
    Receive base64 frames from frontend webcam,
    run YOLO detection, send back annotated frame + detections.
    """
    await websocket.accept()
    det = get_detector()

    try:
        while True:
            data = await websocket.receive_text()
            msg  = json.loads(data)

            # Decode base64 image
            img_data = base64.b64decode(msg["frame"].split(",")[-1])
            nparr    = np.frombuffer(img_data, np.uint8)
            frame    = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                continue

            # Run detection
            detections = det.detect(frame)
            annotated  = det.draw_boxes(frame.copy(), detections)

            # Match plates against DB
            for plate in detections["plates"]:
                emp = db.query(Employee).filter(
                    Employee.license_plate == plate["text"].upper().strip(),
                    Employee.is_active == True
                ).first()
                plate["employee"] = emp.name if emp else "Unknown"
                plate["access"]   = emp is not None

            # Encode annotated frame back to base64
            _, buffer    = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 75])
            b64_frame    = "data:image/jpeg;base64," + base64.b64encode(buffer).decode()

            await websocket.send_text(json.dumps({
                "frame":      b64_frame,
                "plates":     detections["plates"],
                "faces":      detections["faces"],
                "timestamp":  datetime.now().isoformat(),
            }))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_text(json.dumps({"error": str(e)}))
        except:
            pass