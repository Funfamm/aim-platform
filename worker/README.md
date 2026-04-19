# AIM Platform — Subtitle Worker

Lightweight Python FastAPI service that receives subtitle generation jobs
from the Vercel admin dashboard and runs `faster-whisper` locally.

---

## Architecture

```
Admin Dashboard (Vercel)
      │
      │  POST /api/subtitles/generate
      │  { jobId, projectId, videoUrl, language }
      │  + X-Signature: HMAC-SHA256
      ▼
Subtitle Worker  (this service — your PC or VPS)
      │
      ├─ 1. Download video from videoUrl (streaming, size-limited)
      ├─ 2. ffmpeg → 16 kHz mono WAV
      ├─ 3. faster-whisper → timestamped segments + language detection
      ├─ 4. Build .vtt + .srt
      ├─ 5. Upload to Cloudflare R2
      └─ 6. POST callback → Vercel /api/subtitles/callback
               { jobId, vttUrl, srtUrl, segments, language }
               + X-Signature: HMAC-SHA256
```

---

## Quick Start — Docker (recommended)

### 1. Copy example env and fill in values

```bash
cp .env.example .env
# edit .env — fill in WORKER_SECRET, VERCEL_CALLBACK_URL, R2 credentials
```

### 2. Build and start

```bash
docker compose up -d --build
```

### 3. Verify health

```bash
curl http://localhost:8000/health
# → {"status":"ok","model":"base","model_loaded":true}
```

The worker is now ready to receive subtitle jobs from your Vercel dashboard.

---

## Upgrade model size

```bash
WHISPER_MODEL=small docker compose up -d --build
```

| Model | RAM needed | Accuracy | Best for |
|-------|-----------|----------|----------|
| `tiny`  | ~1 GB | Fast/low | Testing only |
| `base`  | ~1.5 GB | Good | Default — works on most PCs |
| `small` | ~2.5 GB | Better | Recommended if hardware allows |
| `medium`| ~5 GB | High | GPU or 16+ GB RAM machine |
| `large-v3`| ~10 GB | Best | GPU only |

---

## Quick Start — No Docker (Windows/Linux)

### Prerequisites
- Python 3.10+
- ffmpeg installed and on PATH  
  Windows: `choco install ffmpeg` or download from https://ffmpeg.org
- 4+ GB free RAM (for `base` model)

### Install

```bash
cd worker
pip install -r requirements.txt
```

### Configure

Create `worker/.env`:

```env
WORKER_SECRET=your_shared_secret_here
VERCEL_CALLBACK_URL=https://your-app.vercel.app/api/subtitles/callback
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_key
R2_SECRET_ACCESS_KEY=your_r2_secret
R2_BUCKET_NAME=aim-platform-subtitles
R2_PUBLIC_URL=https://pub.r2.dev/aim-platform-subtitles
WHISPER_MODEL=base
```

### Run

```bash
# Windows
uvicorn main:app --host 0.0.0.0 --port 8000

# Or in background (keep terminal open):
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

---

## Making the worker reachable from Vercel

You need to expose `http://localhost:8000` to the internet.

### Option A — ngrok (free, for testing)

```bash
ngrok http 8000
# Copy the https://xxx.ngrok-free.app URL
# Set WORKER_URL=https://xxx.ngrok-free.app in Vercel env
```

### Option B — VPS (production)

1. Deploy the Docker image on a VPS (Hetzner, DigitalOcean, etc.)
2. Set `WORKER_URL=https://worker.yourdomain.com` in Vercel env

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WORKER_SECRET` | ✅ | Shared HMAC secret — must match Vercel's `WORKER_SECRET` |
| `VERCEL_CALLBACK_URL` | ✅ | Full URL of Vercel `/api/subtitles/callback` endpoint |
| `R2_ACCOUNT_ID` | ✅ | Cloudflare R2 account ID |
| `R2_ACCESS_KEY_ID` | ✅ | R2 access key |
| `R2_SECRET_ACCESS_KEY` | ✅ | R2 secret key |
| `R2_BUCKET_NAME` | ✅ | R2 bucket name (default: `aim-platform-subtitles`) |
| `R2_PUBLIC_URL` | ✅ | Public base URL for R2 objects (no trailing slash) |
| `WHISPER_MODEL` | — | Model size: `tiny`, `base` (default), `small`, `medium`, `large-v3` |
| `MAX_FILE_SIZE_MB` | — | Max video size in MB (default: `2000`) |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns model status |
| `POST` | `/generate` | Trigger subtitle generation (called by Vercel) |

---

## Security

- All `/generate` requests are verified with `HMAC-SHA256` (header: `X-Signature`).
- All Vercel callbacks are also HMAC-signed so Vercel can verify the worker's identity.
- Never expose the worker on port 8000 to the public without a reverse proxy or firewall rule restricting access to Vercel's IPs.
