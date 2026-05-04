from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.models.models import ParkingLog
from app.schemas.schemas import ParkingLogOut

router = APIRouter()

@router.get("/", response_model=List[ParkingLogOut])
def get_logs(
    skip: int = 0, limit: int = 100,
    access_granted: Optional[bool] = None,
    employee_id: Optional[str] = None,
    entry_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(ParkingLog)
    if access_granted is not None: q = q.filter(ParkingLog.access_granted == access_granted)
    if employee_id:                q = q.filter(ParkingLog.employee_id == employee_id)
    if entry_type:                 q = q.filter(ParkingLog.entry_type == entry_type)
    return q.order_by(ParkingLog.timestamp.desc()).offset(skip).limit(limit).all()