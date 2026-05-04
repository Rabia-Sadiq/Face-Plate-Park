# 🚗 FacePlate Parking System — Complete Guide

Office parking management system using **YOLO face + license plate detection**.
Built with **FastAPI** (backend) + **Next.js 14** (frontend).

---

## 📁 Project Structure

```
faceplatepark/
│
├── backend/                        ← FastAPI Python server
│   ├── app/
│   │   ├── main.py                 ← App entry point, all routers registered
│   │   ├── core/
│   │   │   └── database.py         ← SQLite / PostgreSQL connection
│   │   ├── models/
│   │   │   └── models.py           ← Database tables (Employee, ParkingLog)
│   │   ├── schemas/
│   │   │   └── schemas.py          ← Pydantic request/response shapes
│   │   ├── services/
│   │   │   ├── yolo_detection.py   ← YOLO model + EasyOCR plate reading
│   │   │   └── detection.py        ← Single-image verify (uses yolo_detection)
│   │   └── api/
│   │       ├── employees.py        ← CRUD: add/edit/delete employees
│   │       ├── verify.py           ← Single image verification endpoint
│   │       ├── logs.py             ← Parking history queries
│   │       ├── dashboard.py        ← Stats for dashboard
│   │       └── video.py            ← Video upload + WebSocket live stream
│   ├── models/
│   │   └── best.pt                 ← YOUR YOLO model goes here
│   ├── uploads/
│   │   ├── faces/                  ← Employee face photos stored here
│   │   ├── logs/                   ← Snapshots from image verify
│   │   └── video_snapshots/        ← Snapshots from video detection
│   ├── requirements.txt
│   └── .env                        ← Environment variables
│
└── frontend/                       ← Next.js 14 React app
    └── src/
        ├── app/
        │   ├── layout.tsx           ← Root layout with sidebar
        │   ├── globals.css          ← Global styles + Tailwind
        │   ├── page.tsx             ← Dashboard page
        │   ├── verify/page.tsx      ← Single image verify (camera/upload)
        │   ├── video/page.tsx       ← Video detection (webcam + file)
        │   ├── employees/page.tsx   ← Employee management
        │   └── logs/page.tsx        ← Parking log history
        ├── components/
        │   └── ui/
        │       └── Sidebar.tsx      ← Navigation sidebar
        └── lib/
            └── api.ts               ← Axios API client
```

---

## ⚙️ Prerequisites

| Tool | Minimum Version | Check |
|------|----------------|-------|
| Python | 3.10+ | `python --version` |
| Node.js | 18+ | `node --version` |
| npm | 8+ | `npm --version` |

---

## 🚀 Backend Setup (Step by Step)

### Step 1 — Go to backend folder
```cmd
cd C:\Users\YourName\Desktop\faceplatepark\backend
```

### Step 2 — Create virtual environment
```cmd
python -m venv venv
```

### Step 3 — Activate virtual environment
```cmd
venv\Scripts\activate
```
You will see `(venv)` at the start of your terminal line.

### Step 4 — Install all packages
```cmd
pip install fastapi uvicorn[standard] sqlalchemy python-multipart python-dotenv pydantic[email] numpy opencv-python-headless Pillow ultralytics easyocr websockets
```

> ⏳ This will take 3-5 minutes. EasyOCR downloads language models on first run.

### Step 5 — Create the models folder and add your model
```cmd
mkdir models
```
Copy your `best.pt` file into:
```
backend\models\best.pt
```

### Step 6 — Create .env file
Create a file named `.env` in the backend folder with this content:
```
DATABASE_URL=sqlite:///./faceplatepark.db
FACE_THRESHOLD=0.60
PLATE_THRESHOLD=0.90
YOLO_MODEL_PATH=models/best.pt
```

### Step 7 — Create upload folders
```cmd
mkdir uploads
mkdir uploads\faces
mkdir uploads\logs
mkdir uploads\video_snapshots
```

### Step 8 — Start the backend server
```cmd
uvicorn app.main:app --reload --port 8000
```

### Step 9 — Verify it works
Open your browser and go to:
```
http://localhost:8000
```
You should see:
```json
{"message": "FacePlate Parking API v2 running 🚗🎥"}
```

Check model loaded correctly:
```
http://localhost:8000/api/video/model-info
```
Expected output:
```json
{
  "model_loaded": true,
  "classes": {"0": "face", "1": "license_plate"},
  "face_class_ids": [0],
  "plate_class_ids": [1],
  "easyocr_loaded": true
}
```

View interactive API docs:
```
http://localhost:8000/docs
```

---

## 🖥️ Frontend Setup (Step by Step)

### Step 1 — Open a NEW terminal window (keep backend running)

### Step 2 — Go to frontend folder
```cmd
cd C:\Users\YourName\Desktop\faceplatepark\frontend
```

### Step 3 — Make sure package.json exists
```cmd
dir package.json
```
If it says "File Not Found", create it manually (see troubleshooting section below).

### Step 4 — Install packages
```cmd
npm install
```

### Step 5 — Create .env.local file
Create a file named `.env.local` in the frontend folder:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Step 6 — Start frontend
```cmd
npm run dev
```

### Step 7 — Open the app
```
http://localhost:3000
```

---

## 🗄️ Database

### SQLite (Default — Zero Setup Required)
No setup needed. When you run `uvicorn` for the first time, it automatically creates:
```
backend\faceplatepark.db
```
This is a single file database, perfect for development.

### How to view the database
Download **DB Browser for SQLite** (free):
- https://sqlitebrowser.org/dl/
- Open `backend\faceplatepark.db`
- Browse tables: `employees`, `parking_logs`

### Switch to PostgreSQL (Production)
1. Install PostgreSQL from https://postgresql.org/download/windows
2. Open pgAdmin or psql and run:
```sql
CREATE DATABASE faceplatepark;
CREATE USER parkinguser WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE faceplatepark TO parkinguser;
```
3. Update your `.env` file:
```
DATABASE_URL=postgresql://parkinguser:yourpassword@localhost:5432/faceplatepark
```
4. Install psycopg2:
```cmd
pip install psycopg2-binary
```
5. Restart backend — tables will be created automatically.

---

## 🔌 How the YOLO Model Works

Your `best.pt` model detects **both face and license plate** in one pass.

### Class Name Mapping
When backend starts, it prints detected classes:
```
OK: YOLO model loaded -> models/best.pt
    Detected classes: {0: 'face', 1: 'license_plate'}
    Class 0 'face' -> FACE
    Class 1 'license_plate' -> PLATE
```

If your class names are different (e.g. `head`, `plate`, `lp`), open
`backend/app/services/yolo_detection.py` and add them to the sets at the top:

```python
FACE_CLASS_NAMES  = {
    "face", "faces", "head",        # add your class name here
}
PLATE_CLASS_NAMES = {
    "license_plate", "plate", "lp", # add your class name here
}
```

### Detection Flow
```
Camera / Video Frame
        ↓
    YOLO Model (best.pt)
        ↓
   ┌────┴────┐
   ↓         ↓
 FACE      PLATE bbox
detected   detected
   ↓         ↓
face_recognition  EasyOCR reads
encodes face      plate text
   ↓         ↓
Compare with   Match text against
DB encodings   employees DB
   ↓         ↓
Access Decision (GRANTED / DENIED)
        ↓
    Log saved to DB
    Snapshot saved to uploads/
```

---

## 📱 App Pages

### 1. Dashboard (`/`)
- Live stats: total employees, currently parked, granted/denied today
- Recent activity feed
- Auto-refreshes every 10 seconds

### 2. Verify Entry (`/verify`)
- **Camera mode**: Use webcam, click Capture & Verify
- **Upload mode**: Upload a photo from your computer
- Shows: access granted/denied, employee name, plate detected, face score
- Logs every verification to database

### 3. Video Detection (`/video`)
- **Live Webcam**: Streams frames to backend via WebSocket, YOLO runs in real-time, annotated frame with bounding boxes comes back
- **Upload Video**: Upload MP4/AVI/MOV, backend samples 2 frames/second, returns all detections with snapshots
- Green box = face detected
- Cyan/green box = license plate detected

### 4. Employees (`/employees`)
- Add new employees with photo
- View all registered employees
- Search by name, ID, or plate number
- Delete employees

### 5. Parking Logs (`/logs`)
- Full history of all entries/exits
- Filter by: granted, denied, entry type
- View snapshot for each event

---

## 🔑 Access Logic

| Plate Match | Face Match | Result |
|-------------|------------|--------|
| ✅ Yes | ✅ Yes | ✅ GRANTED |
| ✅ Yes | ❌ No | ✅ GRANTED (plate enough) |
| ❌ No | ✅ Yes (>60%) | ✅ GRANTED (face enough) |
| ❌ No | ❌ No | ❌ DENIED |
| Any | Employee inactive | ❌ DENIED |

Thresholds can be changed in `.env`:
```
FACE_THRESHOLD=0.60    # 60% face similarity minimum
PLATE_THRESHOLD=0.90   # 90% plate match minimum
```

---

## 🌐 API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/` | Health check |
| GET | `/api/dashboard/stats` | Dashboard statistics |
| GET | `/api/employees/` | List all employees |
| POST | `/api/employees/` | Add employee (with face photo) |
| PUT | `/api/employees/{id}` | Update employee |
| DELETE | `/api/employees/{id}` | Delete employee |
| POST | `/api/verify/` | Verify single image |
| GET | `/api/logs/` | Get parking logs |
| POST | `/api/video/process` | Process uploaded video |
| WS | `/api/video/ws/stream` | WebSocket live detection |
| GET | `/api/video/model-info` | Check model status |
| GET | `/docs` | Interactive API documentation |

---

## ❌ Common Errors and Fixes

### `'ls' is not recognized`
Use Windows commands:
```cmd
dir          ← instead of ls
cls          ← instead of clear
type file    ← instead of cat file
```

### `DATABASE_URL is not recognized`
Do NOT set env vars like Linux. Use `.env` file instead, or:
```cmd
set DATABASE_URL=sqlite:///./faceplatepark.db
```

### `mkdir -p` syntax error
Windows syntax:
```cmd
mkdir uploads
mkdir uploads\faces
mkdir uploads\logs
```

### `npm error ENOENT package.json`
The `package.json` file is missing. Create it manually — see full file content in the previous chat.

### `AttributeError: YOLODetector has no attribute 'detect'`
Your `yolo_detection.py` is outdated. Replace with the latest version from this project.

### `Model not found at models/best.pt`
Make sure:
1. You created the `models` folder inside `backend`
2. `best.pt` is inside `backend/models/best.pt`
3. You are running `uvicorn` from inside the `backend` folder

### EasyOCR downloads on first run
First time EasyOCR starts, it downloads ~100MB language model. This is normal. Wait for it to finish.

### WebSocket connection failed in Video page
Make sure backend is running on port 8000 before starting detection.

### `CORS error` in browser
Backend must be running. Check that `allow_origins` in `main.py` includes `http://localhost:3000`.

---

## 🔄 Daily Usage

**Every time you want to run the system:**

Terminal 1 — Backend:
```cmd
cd faceplatepark\backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

Terminal 2 — Frontend:
```cmd
cd faceplatepark\frontend
npm run dev
```

Open browser: `http://localhost:3000`

---

## 📦 All Packages Reference

### Backend
```
fastapi              - Web framework
uvicorn              - ASGI server
sqlalchemy           - Database ORM
python-multipart     - File upload support
python-dotenv        - .env file loading
pydantic[email]      - Data validation
numpy                - Array operations
opencv-python-headless - Image processing
Pillow               - Image handling
ultralytics          - YOLO model (your best.pt)
easyocr              - License plate OCR
websockets           - WebSocket support
```

### Frontend
```
next                 - React framework
react / react-dom    - UI library
lucide-react         - Icons
axios                - HTTP client
date-fns             - Date formatting
react-hot-toast      - Toast notifications
tailwindcss          - Styling
typescript           - Type safety
```