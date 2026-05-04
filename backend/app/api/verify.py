from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
import os, uuid
from datetime import datetime

from app.core.database import get_db
from app.models.models import Employee, ParkingLog
from app.schemas.schemas import VerifyResult
from app.services.detection import (
    detect_license_plate, detect_and_encode_face,
    compare_faces, FACE_MATCH_THRESHOLD
)

router = APIRouter()
SNAPSHOT_DIR = "uploads/logs"
os.makedirs(SNAPSHOT_DIR, exist_ok=True)

@router.post("/", response_model=VerifyResult)
async def verify_vehicle(
    entry_type: str = Form("ENTRY"),
    image: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    img_bytes = await image.read()

    # Save snapshot
    snap_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.jpg"
    snap_path = os.path.join(SNAPSHOT_DIR, snap_name)
    with open(snap_path, "wb") as f:
        f.write(img_bytes)

    # 1. License plate detection
    plate_detected = detect_license_plate(img_bytes)
    plate_match, matched_emp = False, None
    if plate_detected:
        matched_emp = db.query(Employee).filter(
            Employee.license_plate == plate_detected.upper().strip(),
            Employee.is_active == True
        ).first()
        plate_match = matched_emp is not None

    # 2. Face detection & matching
    face_detected, face_match_score = False, None
    live_encoding = detect_and_encode_face(img_bytes)
    if live_encoding:
        face_detected = True
        if matched_emp and matched_emp.face_encoding:
            face_match_score = compare_faces(matched_emp.face_encoding, live_encoding)
        else:
            best_score, best_emp = 0.0, None
            for emp in db.query(Employee).filter(Employee.is_active == True, Employee.face_encoding != None).all():
                score = compare_faces(emp.face_encoding, live_encoding)
                if score > best_score:
                    best_score, best_emp = score, emp
            if best_score >= FACE_MATCH_THRESHOLD:
                face_match_score, matched_emp = best_score, best_emp

    # 3. Access decision
    face_ok = face_match_score is not None and face_match_score >= FACE_MATCH_THRESHOLD
    access  = plate_match or face_ok
    if not matched_emp:
        msg = "❌ Unknown vehicle — access denied"
    elif not access:
        msg = "❌ Identity mismatch — access denied"
    else:
        msg = f"✅ Access granted — Welcome, {matched_emp.name}!"

    # 4. Save log
    log = ParkingLog(
        employee_id=matched_emp.employee_id if matched_emp else None,
        employee_name=matched_emp.name if matched_emp else None,
        license_plate_detected=plate_detected,
        face_detected=face_detected, face_match_score=face_match_score,
        plate_match=plate_match, access_granted=access,
        entry_type=entry_type, snapshot_path=snap_path, notes=msg,
    )
    db.add(log); db.commit(); db.refresh(log)

    return VerifyResult(
        access_granted=access,
        employee_name=matched_emp.name if matched_emp else None,
        employee_id=matched_emp.employee_id if matched_emp else None,
        license_plate_detected=plate_detected,
        face_match_score=face_match_score, plate_match=plate_match,
        face_detected=face_detected, message=msg,
        snapshot_path=snap_path, log_id=log.id,
    )