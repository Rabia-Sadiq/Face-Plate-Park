from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import json, os, uuid

from app.core.database import get_db
from app.models.models import Employee
from app.schemas.schemas import EmployeeOut
from app.services.detection import detect_and_encode_face

router = APIRouter()
UPLOAD_DIR = "uploads/faces"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/", response_model=List[EmployeeOut])
def list_employees(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Employee).offset(skip).limit(limit).all()

@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(employee_id: str, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp

@router.post("/", response_model=EmployeeOut)
async def create_employee(
    name: str = Form(...),
    employee_id: str = Form(...),
    department: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    license_plate: str = Form(...),
    face_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    if db.query(Employee).filter(Employee.employee_id == employee_id).first():
        raise HTTPException(400, "Employee ID already exists")
    if db.query(Employee).filter(Employee.license_plate == license_plate.upper()).first():
        raise HTTPException(400, "License plate already registered")

    face_path, face_encoding = None, None
    if face_image:
        img_bytes = await face_image.read()
        ext = face_image.filename.split(".")[-1]
        filename = f"{employee_id}_{uuid.uuid4().hex[:8]}.{ext}"
        face_path = os.path.join(UPLOAD_DIR, filename)
        with open(face_path, "wb") as f:
            f.write(img_bytes)
        enc = detect_and_encode_face(img_bytes)
        if enc:
            face_encoding = json.dumps(enc)

    emp = Employee(
        name=name, employee_id=employee_id, department=department,
        email=email, phone=phone,
        license_plate=license_plate.upper().strip(),
        face_image_path=face_path, face_encoding=face_encoding,
    )
    db.add(emp); db.commit(); db.refresh(emp)
    return emp

@router.put("/{employee_id}", response_model=EmployeeOut)
async def update_employee(
    employee_id: str,
    name: Optional[str] = Form(None),
    department: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    license_plate: Optional[str] = Form(None),
    is_active: Optional[bool] = Form(None),
    face_image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    emp = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")
    if name:          emp.name = name
    if department:    emp.department = department
    if email:         emp.email = email
    if phone:         emp.phone = phone
    if license_plate: emp.license_plate = license_plate.upper().strip()
    if is_active is not None: emp.is_active = is_active
    if face_image:
        img_bytes = await face_image.read()
        ext = face_image.filename.split(".")[-1]
        filename = f"{employee_id}_{uuid.uuid4().hex[:8]}.{ext}"
        face_path = os.path.join(UPLOAD_DIR, filename)
        with open(face_path, "wb") as f: f.write(img_bytes)
        emp.face_image_path = face_path
        enc = detect_and_encode_face(img_bytes)
        if enc: emp.face_encoding = json.dumps(enc)
    db.commit(); db.refresh(emp)
    return emp

@router.delete("/{employee_id}")
def delete_employee(employee_id: str, db: Session = Depends(get_db)):
    emp = db.query(Employee).filter(Employee.employee_id == employee_id).first()
    if not emp:
        raise HTTPException(404, "Employee not found")
    db.delete(emp); db.commit()
    return {"message": f"Employee {employee_id} deleted"}