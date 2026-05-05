version: "3.9"

services:

  # ── FastAPI Backend ──────────────────────────────────────────────────────────
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: faceplatepark_backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=sqlite:///./faceplatepark.db
      - FACE_THRESHOLD=0.60
      - PLATE_THRESHOLD=0.90
      - YOLO_MODEL_PATH=models/best.pt
    volumes:
      # Persist database and uploads outside container
      - ./backend/faceplatepark# backend/Dockerfile
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads models

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"].db:/app/faceplatepark.db
      - ./backend/uploads:/app/uploads
      - ./backend/models:/app/models
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ── Next.js Frontend ─────────────────────────────────────────────────────────
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        # This tells frontend where to find the backend
        # Change to your server IP in production
        NEXT_PUBLIC_API_URL: http://localhost:8000
    container_name: faceplatepark_frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped

# ── Named volumes (optional — for PostgreSQL later) ───────────────────────────
volumes:
  uploads_data:# backend/Dockerfile
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads models

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]