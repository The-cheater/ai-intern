FROM python:3.11-slim

WORKDIR /app

# System deps for OpenCV, MediaPipe, ffmpeg (Whisper)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p outputs/calibration outputs/session

EXPOSE 8000

# Single worker: Whisper and SentenceTransformer are process-local singletons.
# Multiple workers bypass _whisper_lock and each load their own model copy (~1 GB each).
# To scale horizontally use a task queue (Celery/ARQ) or a dedicated transcription service.
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--timeout-keep-alive", "120"]
