"""
faster-whisper subtitle worker — main.py

Responsibilities:
  1. Receive a signed job request from Vercel (/generate)
  2. Download the source video from its URL
  3. Extract a 16 kHz mono WAV using ffmpeg
  4. Transcribe with faster-whisper (configurable model size)
  5. Generate .vtt and .srt subtitle files
  6. Upload both files to Cloudflare R2
  7. POST the result (URLs + segments) back to the Vercel callback
  8. Clean up all temporary files

SECURITY:
  - All incoming requests are verified with HMAC-SHA256 (X-Signature header).
  - The shared secret is WORKER_SECRET in the environment.

CONFIGURATION (env vars):
  WORKER_SECRET       — shared HMAC secret (must match Vercel's WORKER_SECRET)
  VERCEL_CALLBACK_URL — full URL of the Vercel callback endpoint
  R2_ACCOUNT_ID       — Cloudflare R2 account ID
  R2_ACCESS_KEY_ID    — Cloudflare R2 access key
  R2_SECRET_ACCESS_KEY— Cloudflare R2 secret key
  R2_BUCKET_NAME      — name of the R2 bucket for subtitle files
  R2_PUBLIC_URL       — public base URL for R2 objects (no trailing slash)
  WHISPER_MODEL       — model size: tiny, base (default), small, medium, large-v3
  MAX_FILE_SIZE_MB    — max video file size to accept (default: 2000)
"""

import asyncio
import hashlib
import hmac
import logging
import os
import subprocess
import tempfile
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import boto3
import httpx
from faster_whisper import WhisperModel
from fastapi import BackgroundTasks, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "msg": %(message)s}',
)
log = logging.getLogger("worker")

# ── Load .env (local dev — no-op in production/Docker where env vars are injected) ──
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"), override=False)
except ImportError:
    pass  # python-dotenv not installed — rely on OS environment

# ── Config ────────────────────────────────────────────────────────────────────
WORKER_SECRET = os.environ.get("WORKER_SECRET", "")
VERCEL_CALLBACK_URL = os.environ.get("VERCEL_CALLBACK_URL", "")
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME", "aim-platform-subtitles")
R2_PUBLIC_URL = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")
MAX_FILE_SIZE_MB = int(os.environ.get("MAX_FILE_SIZE_MB", "2000"))

# ── Model: load once at startup ───────────────────────────────────────────────
_whisper_model: WhisperModel | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _whisper_model
    log.info(f'"Loading Whisper model: {WHISPER_MODEL_SIZE}"')
    _whisper_model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
    log.info('"Whisper model ready"')
    yield
    log.info('"Worker shutting down"')


app = FastAPI(title="AIM Subtitle Worker", lifespan=lifespan)

# ── R2 client ─────────────────────────────────────────────────────────────────
def get_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
    )


# ── HMAC helpers ──────────────────────────────────────────────────────────────
def verify_signature(body: bytes, provided: str | None) -> bool:
    if not WORKER_SECRET or not provided:
        return False
    expected = hmac.new(WORKER_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, provided)


def sign_payload(payload: dict) -> str:
    import json
    body = json.dumps(payload, separators=(",", ":"))
    return hmac.new(WORKER_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()


# ── VTT / SRT formatters ──────────────────────────────────────────────────────
def _fmt_time_vtt(seconds: float) -> str:
    ms = int((seconds % 1) * 1000)
    s = int(seconds) % 60
    m = int(seconds) // 60 % 60
    h = int(seconds) // 3600
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def _fmt_time_srt(seconds: float) -> str:
    return _fmt_time_vtt(seconds).replace(".", ",")


def build_vtt(segments: list[dict]) -> str:
    lines = ["WEBVTT", ""]
    for i, seg in enumerate(segments, 1):
        lines.append(str(i))
        lines.append(f"{_fmt_time_vtt(seg['start'])} --> {_fmt_time_vtt(seg['end'])}")
        lines.append(seg["text"].strip())
        lines.append("")
    return "\n".join(lines)


def build_srt(segments: list[dict]) -> str:
    lines = []
    for i, seg in enumerate(segments, 1):
        lines.append(str(i))
        lines.append(f"{_fmt_time_srt(seg['start'])} --> {_fmt_time_srt(seg['end'])}")
        lines.append(seg["text"].strip())
        lines.append("")
    return "\n".join(lines)


# ── R2 upload ─────────────────────────────────────────────────────────────────
def upload_to_r2(content: str, key: str, content_type: str) -> str:
    r2 = get_r2_client()
    r2.put_object(
        Bucket=R2_BUCKET_NAME,
        Key=key,
        Body=content.encode("utf-8"),
        ContentType=content_type,
        ACL="public-read",
    )
    return f"{R2_PUBLIC_URL}/{key}"


# ── Callback helpers ──────────────────────────────────────────────────────────
async def send_callback(payload: dict, max_retries: int = 3) -> None:
    import json
    body = json.dumps(payload, separators=(",", ":"))
    sig = hmac.new(WORKER_SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()

    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.post(
                    VERCEL_CALLBACK_URL,
                    content=body,
                    headers={"Content-Type": "application/json", "X-Signature": sig},
                )
                job_id_cb = payload.get("jobId", "unknown")
                if res.status_code < 300:
                    log.info(f'"Callback sent for job {job_id_cb}, attempt {attempt}"')
                    return
                log.warning(f'"Callback HTTP {res.status_code} on attempt {attempt}"')
        except Exception as exc:
            log.warning(f'"Callback error on attempt {attempt}: {exc}"')

        if attempt < max_retries:
            await asyncio.sleep(2 ** attempt)  # exponential back-off: 2s, 4s

    job_id_cb = payload.get("jobId", "unknown")
    log.error(f'"All callback attempts failed for job {job_id_cb}"')


# ── Core transcription task ───────────────────────────────────────────────────
async def run_transcription(job_id: str, project_id: str, video_url: str, language: str) -> None:
    start_time = time.monotonic()
    tmp_dir = tempfile.mkdtemp(prefix="aim_subtitle_")
    video_path = Path(tmp_dir) / "video.mp4"
    audio_path = Path(tmp_dir) / "audio.wav"

    try:
        # 1. Notify Vercel: job is now processing
        await send_callback({"jobId": job_id, "workerRunId": f"local-{job_id[:8]}"})

        # 2. Download video (streaming, size-limited)
        log.info(f'"Downloading video for job {job_id}"')
        max_bytes = MAX_FILE_SIZE_MB * 1024 * 1024
        downloaded = 0
        async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
            async with client.stream("GET", video_url) as resp:
                resp.raise_for_status()
                with open(video_path, "wb") as f:
                    async for chunk in resp.aiter_bytes(chunk_size=1024 * 1024):
                        downloaded += len(chunk)
                        if downloaded > max_bytes:
                            raise ValueError(f"Video exceeds {MAX_FILE_SIZE_MB} MB limit")
                        f.write(chunk)
        log.info(f'"Video downloaded: {downloaded / 1e6:.1f} MB"')

        # 3. Extract 16 kHz mono WAV with ffmpeg
        log.info(f'"Extracting audio for job {job_id}"')
        result = subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(video_path),
                "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                str(audio_path),
            ],
            capture_output=True,
            timeout=600,
        )
        if result.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {result.stderr.decode()[:500]}")

        # 4. Transcribe with faster-whisper
        log.info(f'"Transcribing with {WHISPER_MODEL_SIZE} model for job {job_id}"')
        if _whisper_model is None:
            raise RuntimeError("Whisper model not loaded")

        lang_arg = None if language in ("auto", "") else language
        whisper_segs, info = _whisper_model.transcribe(
            str(audio_path), language=lang_arg, vad_filter=True
        )
        detected_lang = info.language

        segments: list[dict[str, Any]] = []
        for seg in whisper_segs:
            segments.append({"start": round(seg.start, 3), "end": round(seg.end, 3), "text": seg.text})

        log.info(f'"Transcribed {len(segments)} segments in language={detected_lang}"')

        # 5. Build VTT and SRT
        vtt_content = build_vtt(segments)
        srt_content = build_srt(segments)

        # 6. Upload to R2
        ts = int(time.time())
        vtt_key = f"subtitles/{project_id}/{job_id}-{ts}.vtt"
        srt_key = f"subtitles/{project_id}/{job_id}-{ts}.srt"
        vtt_url = upload_to_r2(vtt_content, vtt_key, "text/vtt")
        srt_url = upload_to_r2(srt_content, srt_key, "text/plain")
        log.info(f'"Uploaded subtitles for job {job_id}: {vtt_url}"')

        # 7. Send success callback
        elapsed = round(time.monotonic() - start_time, 1)
        await send_callback({
            "jobId": job_id,
            "workerRunId": f"local-{job_id[:8]}",
            "vttUrl": vtt_url,
            "srtUrl": srt_url,
            "segments": segments,
            "language": detected_lang,
            "durationSeconds": elapsed,
        })

    except Exception as exc:
        log.error(f'"Transcription failed for job {job_id}: {exc}"')
        await send_callback({"jobId": job_id, "error": str(exc)[:500]})

    finally:
        # 8. Clean up temp files
        for p in [audio_path, video_path]:
            try:
                p.unlink(missing_ok=True)
            except Exception:
                pass
        try:
            Path(tmp_dir).rmdir()
        except Exception:
            pass


# ── FastAPI routes ─────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "model": WHISPER_MODEL_SIZE, "model_loaded": _whisper_model is not None}


@app.post("/generate")
async def generate(request: Request, background_tasks: BackgroundTasks):
    # Verify HMAC signature
    body = await request.body()
    sig = request.headers.get("x-signature")
    if not verify_signature(body, sig):
        raise HTTPException(status_code=401, detail="Invalid signature")

    import json
    payload = json.loads(body)
    job_id = payload.get("jobId")
    project_id = payload.get("projectId")
    video_url = payload.get("videoUrl")
    language = payload.get("language", "auto")

    if not job_id or not video_url:
        raise HTTPException(status_code=400, detail="jobId and videoUrl are required")

    if not VERCEL_CALLBACK_URL:
        raise HTTPException(status_code=503, detail="VERCEL_CALLBACK_URL not configured")

    log.info(f'"Accepted job {job_id} for project {project_id}"')
    background_tasks.add_task(run_transcription, job_id, project_id, video_url, language)

    return JSONResponse({"accepted": True, "jobId": job_id})
