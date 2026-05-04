from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date

from app.core.database import get_db
from app.models.models import ParkingLog, Employee
from app.schemas.schemas import DashboardStats

router = APIRouter()

@router.get("/stats", response_model=DashboardStats)
def get_stats(db: Session = Depends(get_db)):
    today = date.today()
    total_employees  = db.query(func.count(Employee.id)).scalar()
    active_employees = db.query(func.count(Employee.id)).filter(Employee.is_active == True).scalar()
    today_q          = db.query(ParkingLog).filter(func.date(ParkingLog.timestamp) == today)
    total_today      = today_q.count()
    granted_today    = today_q.filter(ParkingLog.access_granted == True).count()
    denied_today     = total_today - granted_today
    entries = db.query(ParkingLog).filter(ParkingLog.access_granted==True, ParkingLog.entry_type=="ENTRY", func.date(ParkingLog.timestamp)==today).count()
    exits   = db.query(ParkingLog).filter(ParkingLog.access_granted==True, ParkingLog.entry_type=="EXIT",  func.date(ParkingLog.timestamp)==today).count()
    recent  = db.query(ParkingLog).order_by(ParkingLog.timestamp.desc()).limit(10).all()
    return DashboardStats(
        total_employees=total_employees, active_employees=active_employees,
        total_logs_today=total_today, granted_today=granted_today,
        denied_today=denied_today, currently_parked=max(0, entries-exits),
        recent_logs=recent,
    )