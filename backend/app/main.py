from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.database import engine, Base
from app.api import employees, verify, logs, dashboard, video   # ← video added

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FacePlate Parking System",
    description="Office Parking with Face & License Plate Detection",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(employees.router,  prefix="/api/employees",  tags=["Employees"])
app.include_router(verify.router,     prefix="/api/verify",     tags=["Verification"])
app.include_router(logs.router,       prefix="/api/logs",       tags=["Logs"])
app.include_router(dashboard.router,  prefix="/api/dashboard",  tags=["Dashboard"])
app.include_router(video.router,      prefix="/api/video",      tags=["Video Detection"])  # ← new

@app.get("/")
def root():
    return {"message": "FacePlate Parking API v2 running 🚗🎥"}

@app.get("/api/video/model-info")
def model_info():
    from app.services.yolo_detection import YOLODetector
    det = YOLODetector()
    return det.get_class_info()