from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class EmployeeCreate(BaseModel):
    name: str
    employee_id: str
    department: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    license_plate: str

class EmployeeOut(BaseModel):
    id: int
    name: str
    employee_id: str
    department: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    license_plate: str
    face_image_path: Optional[str]
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class VerifyResult(BaseModel):
    access_granted: bool
    employee_name: Optional[str]
    employee_id: Optional[str]
    license_plate_detected: Optional[str]
    face_match_score: Optional[float]
    plate_match: bool
    face_detected: bool
    message: str
    snapshot_path: Optional[str]
    log_id: int

class ParkingLogOut(BaseModel):
    id: int
    employee_id: Optional[str]
    employee_name: Optional[str]
    license_plate_detected: Optional[str]
    face_detected: bool
    face_match_score: Optional[float]
    plate_match: bool
    access_granted: bool
    entry_type: str
    snapshot_path: Optional[str]
    notes: Optional[str]
    timestamp: datetime
    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    total_employees: int
    active_employees: int
    total_logs_today: int
    granted_today: int
    denied_today: int
    currently_parked: int
    recent_logs: list[ParkingLogOut]