from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Float
from sqlalchemy.sql import func
from app.core.database import Base

class Employee(Base):
    __tablename__ = "employees"

    id              = Column(Integer, primary_key=True, index=True)
    name            = Column(String(100), nullable=False)
    employee_id     = Column(String(50), unique=True, nullable=False)
    department      = Column(String(100))
    email           = Column(String(150), unique=True)
    phone           = Column(String(20))
    license_plate   = Column(String(20), unique=True, nullable=False)
    face_image_path = Column(String(255))
    face_encoding   = Column(Text)          # JSON list of floats
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), onupdate=func.now())


class ParkingLog(Base):
    __tablename__ = "parking_logs"

    id                      = Column(Integer, primary_key=True, index=True)
    employee_id             = Column(String(50), nullable=True)
    employee_name           = Column(String(100), nullable=True)
    license_plate_detected  = Column(String(20))
    face_detected           = Column(Boolean, default=False)
    face_match_score        = Column(Float, nullable=True)
    plate_match             = Column(Boolean, default=False)
    access_granted          = Column(Boolean, default=False)
    entry_type              = Column(String(10), default="ENTRY")   # ENTRY / EXIT
    snapshot_path           = Column(String(255))
    notes                   = Column(Text, nullable=True)
    timestamp               = Column(DateTime(timezone=True), server_default=func.now())