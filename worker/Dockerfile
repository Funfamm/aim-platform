# ── AIM Platform — Subtitle Worker Dockerfile ─────────────────────────────────
# Multi-stage build to keep the final image lean.
#
# Stage 1: Builder — install Python dependencies
# Stage 2: Runtime — copy only what's needed + add ffmpeg

FROM python:3.11-slim AS builder

WORKDIR /app

# Install build tools for faster-whisper's native extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
      gcc g++ libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ──────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

WORKDIR /app

# Runtime system deps: ffmpeg for audio extraction
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy worker source
COPY main.py .

# Pre-download the Whisper model at build time so the container starts fast.
# WHISPER_MODEL defaults to "base"; override with --build-arg WHISPER_MODEL=small
ARG WHISPER_MODEL=base
ENV WHISPER_MODEL=${WHISPER_MODEL}

RUN python -c "from faster_whisper import WhisperModel; WhisperModel('${WHISPER_MODEL}', device='cpu', compute_type='int8')"

# Worker listens on 8000
EXPOSE 8000

# Health-check (Docker will mark the container unhealthy if /health fails)
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
