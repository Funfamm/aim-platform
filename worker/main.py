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
import shutil
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
WORKER_SECRET = os.environ.get("WORKER_SECRET", "").strip().strip('"').strip("'")
VERCEL_CALLBACK_URL = os.environ.get("VERCEL_CALLBACK_URL", "")
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME", "aim-platform-subtitles")
R2_PUBLIC_URL = os.environ.get("R2_PUBLIC_URL", "").rstrip("/")
WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL", "base")
MAX_FILE_SIZE_MB = int(os.environ.get("MAX_FILE_SIZE_MB", "2000"))
VERCEL_BYPASS_SECRET = os.environ.get("VERCEL_BYPASS_SECRET", "").strip()
# Bearer token used by AIM Studio Lite's /transcribe compatibility endpoint
TRANSCRIPTION_SECRET = os.environ.get("TRANSCRIPTION_SECRET", "").strip()
# ── Groq (cloud Whisper — primary engine when configured) ─────────────────────
# Support multiple keys: GROQ_API_KEYS=key1,key2,key3
# Falls back to GROQ_API_KEY (single) if GROQ_API_KEYS not set.
# On 429 rate-limit the worker rotates to the next key automatically.
_groq_keys_raw = os.environ.get("GROQ_API_KEYS", "").strip()
if _groq_keys_raw:
    GROQ_API_KEYS: list[str] = [k.strip() for k in _groq_keys_raw.split(",") if k.strip()]
else:
    _single = os.environ.get("GROQ_API_KEY", "").strip()
    GROQ_API_KEYS = [_single] if _single else []
GROQ_API_KEY = GROQ_API_KEYS[0] if GROQ_API_KEYS else ""  # kept for health endpoint
GROQ_MODEL   = os.environ.get("GROQ_MODEL", "whisper-large-v3")
GROQ_CHUNK_MINUTES = int(os.environ.get("GROQ_CHUNK_MINUTES", "20"))
GROQ_MAX_BYTES = 24 * 1024 * 1024  # 24 MB — stay under Groq's 25 MB limit

# ── Model: load once at startup ───────────────────────────────────────────────
_whisper_model: WhisperModel | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _whisper_model
    if GROQ_API_KEY:
        log.info(f'"Groq mode enabled ({GROQ_MODEL}) — skipping local Whisper model load"')
    else:
        log.info(f'"Loading local Whisper model: {WHISPER_MODEL_SIZE}"')
        _whisper_model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
        log.info('"Local Whisper model ready"')
    yield
    log.info('"Worker shutting down"')



app = FastAPI(title="AIM Subtitle Worker", lifespan=lifespan)

# ── Concurrency limiter ───────────────────────────────────────────────────────
# Only run one transcription at a time — CPU/RAM bound. Later jobs wait cleanly
# instead of piling up and OOM-killing the process.
_transcription_sem = asyncio.Semaphore(1)

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

    headers: dict = {"Content-Type": "application/json", "X-Signature": sig}
    if VERCEL_BYPASS_SECRET:
        headers["x-vercel-protection-bypass"] = VERCEL_BYPASS_SECRET

    for attempt in range(1, max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                res = await client.post(
                    VERCEL_CALLBACK_URL,
                    content=body,
                    headers=headers,
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


# ── Groq transcription helpers ────────────────────────────────────────────────

def _groq_upload_chunk(chunk_path: Path, language: str | None, offset: float) -> tuple[list[dict], str]:
    """Synchronous Groq API call — run inside asyncio.to_thread.
    Rotates through GROQ_API_KEYS on 429 rate-limit responses.
    Raises RuntimeError if all keys are exhausted.
    """
    import httpx
    data: dict = {"model": GROQ_MODEL, "response_format": "verbose_json"}
    if language:
        data["language"] = language

    last_err: Exception | None = None
    for i, key in enumerate(GROQ_API_KEYS):
        try:
            with open(chunk_path, "rb") as f:
                r = httpx.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {key}"},
                    files={"file": (chunk_path.name, f, "audio/mpeg")},
                    data=data,
                    timeout=120,
                )
            if r.status_code == 429:
                log.warning(f'"Groq key {i+1}/{len(GROQ_API_KEYS)} hit rate limit (429) — trying next key"')
                last_err = Exception(f"Key {i+1} rate-limited")
                continue  # try next key
            r.raise_for_status()
            result = r.json()
            segs = [
                {"start": round(s["start"] + offset, 3), "end": round(s["end"] + offset, 3), "text": s["text"]}
                for s in result.get("segments", [])
            ]
            return segs, result.get("language", language or "en")
        except Exception as exc:
            if "rate" in str(exc).lower() or "429" in str(exc):
                log.warning(f'"Groq key {i+1}/{len(GROQ_API_KEYS)} rate-limited — trying next key"')
                last_err = exc
                continue
            raise  # non-rate-limit errors propagate immediately

    raise RuntimeError(f"All {len(GROQ_API_KEYS)} Groq key(s) exhausted: {last_err}")


async def transcribe_with_groq(audio_path: Path, language: str | None) -> tuple[list[dict], str]:
    """Transcribe via Groq Whisper API (whisper-large-v3 on cloud GPUs, free tier).
    Auto-chunks files larger than GROQ_MAX_BYTES.
    """
    file_size = audio_path.stat().st_size
    if file_size <= GROQ_MAX_BYTES:
        log.info(f'"Groq: uploading {file_size/1e6:.1f} MB in one shot"')
        return await asyncio.to_thread(_groq_upload_chunk, audio_path, language, 0.0)

    # ── Chunked path ────────────────────────────────────────────────────────
    log.info(f'"Groq: file {file_size/1e6:.1f} MB > {GROQ_MAX_BYTES/1e6:.0f} MB — chunking into {GROQ_CHUNK_MINUTES}-min segments"')

    def _get_duration() -> float:
        import json as _json
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", str(audio_path)],
            capture_output=True, timeout=30,
        )
        return float(_json.loads(r.stdout)["format"]["duration"])

    duration = await asyncio.to_thread(_get_duration)
    chunk_secs = GROQ_CHUNK_MINUTES * 60
    all_segments: list[dict] = []
    detected_lang = language or "en"
    offset = 0.0
    idx = 0

    while offset < duration:
        chunk_path = audio_path.parent / f"_chunk_{idx}.mp3"
        start = offset
        def _cut_chunk(s=start, out=chunk_path):
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(audio_path), "-ss", str(s),
                 "-t", str(chunk_secs), "-acodec", "copy", str(out)],
                capture_output=True, timeout=120,
            )
        await asyncio.to_thread(_cut_chunk)
        segs, lang = await asyncio.to_thread(_groq_upload_chunk, chunk_path, language, offset)
        all_segments.extend(segs)
        detected_lang = lang
        chunk_path.unlink(missing_ok=True)
        offset += chunk_secs
        idx += 1

    return all_segments, detected_lang


# ── Core transcription task ───────────────────────────────────────────────────

async def _download_and_transcribe(video_url: str, language: str, tmp_dir: str) -> tuple[list[dict], str]:
    """Download a video, extract audio, and run transcription.

    Shared by both /generate (async callback) and /transcribe (sync response).
    Returns (segments, detected_language). Temp files are written into tmp_dir;
    the caller is responsible for cleanup.
    """
    video_path = Path(tmp_dir) / "video.mp4"

    # Download video (streaming, size-limited)
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

    # Extract audio (MP3 for Groq, WAV for local faster-whisper)
    use_groq = bool(GROQ_API_KEY)
    audio_ext = "mp3" if use_groq else "wav"
    audio_path = Path(tmp_dir) / f"audio.{audio_ext}"
    log.info(f'"Extracting audio as {audio_ext}"')

    if not video_path.exists() or video_path.stat().st_size == 0:
        raise RuntimeError("Downloaded video file is missing or empty")

    def _run_ffmpeg():
        if use_groq:
            cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(video_path),
                   "-vn", "-acodec", "libmp3lame", "-ab", "64k", "-ar", "16000", "-ac", "1",
                   str(audio_path)]
        else:
            cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", str(video_path),
                   "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                   str(audio_path)]
        return subprocess.run(cmd, capture_output=True, text=True, timeout=600)

    ffmpeg_result = await asyncio.to_thread(_run_ffmpeg)
    if ffmpeg_result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {(ffmpeg_result.stderr or ffmpeg_result.stdout)[:500]}")

    if not audio_path.exists() or audio_path.stat().st_size == 0:
        raise RuntimeError("FFmpeg produced no output audio file")

    # Transcribe — Groq cloud (primary) or local faster-whisper (fallback)
    lang_arg = None if language in ("auto", "") else language
    log.info(f'"transcriptionStarted engine={"groq" if use_groq else "local"} lang={lang_arg}"')

    if use_groq:
        log.info(f'"Using Groq {GROQ_MODEL}"')
        segments, detected_lang = await transcribe_with_groq(audio_path, lang_arg)
    else:
        log.info(f'"Using local faster-whisper ({WHISPER_MODEL_SIZE})"')
        if _whisper_model is None:
            raise RuntimeError("Whisper model not loaded")

        def _run_whisper():
            segs, inf = _whisper_model.transcribe(
                str(audio_path), language=lang_arg, vad_filter=True
            )
            return list(segs), inf

        whisper_segs_list, info = await asyncio.to_thread(_run_whisper)
        detected_lang = info.language
        segments = [
            {"start": round(s.start, 3), "end": round(s.end, 3), "text": s.text}
            for s in whisper_segs_list
        ]

    log.info(
        f'"transcriptionSucceeded=true detectedLanguage={detected_lang}'
        f' segmentCount={len(segments)}'
        f' firstSegment={repr(segments[0]["text"][:60]) if segments else "(empty)"}"'
    )
    if not segments:
        log.warning('"WARNING: segmentCount=0 — no speech detected"')

    return segments, detected_lang


async def _guarded_transcription(job_id: str, project_id: str, video_url: str, language: str, media_type: str = "movie") -> None:
    """Wrapper that enforces the concurrency semaphore.
    If a job is already running, this awaits until it finishes before starting.
    The event loop stays free the whole time — semaphore.acquire is non-blocking.
    """
    log.info(f'"Job {job_id} waiting for semaphore (another job may be running)"')
    async with _transcription_sem:
        log.info(f'"Job {job_id} acquired semaphore — starting transcription"')
        await run_transcription(job_id, project_id, video_url, language, media_type)


async def run_transcription(job_id: str, project_id: str, video_url: str, language: str, media_type: str = "movie") -> None:

    start_time = time.monotonic()
    tmp_dir = tempfile.mkdtemp(prefix="aim_subtitle_")

    try:
        # 1. Notify Vercel: job is now processing
        await send_callback({"jobId": job_id, "workerRunId": f"local-{job_id[:8]}"})

        # 2–4. Download video, extract audio, transcribe
        log.info(f'"Downloading and transcribing video for job {job_id}"')
        segments, detected_lang = await _download_and_transcribe(video_url, language, tmp_dir)
        log.info(f'"Transcribed {len(segments)} segments language={detected_lang} job={job_id}"')

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
            "mediaType": media_type,
            "durationSeconds": elapsed,
        })

    except Exception as exc:
        log.error(f'"Transcription failed for job {job_id}: {exc}"')
        await send_callback({"jobId": job_id, "error": str(exc)[:500], "mediaType": media_type})

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ── FastAPI routes ─────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    if GROQ_API_KEY:
        engine = "groq"
        model  = GROQ_MODEL
    else:
        engine = "local"
        model  = WHISPER_MODEL_SIZE
    return {
        "status": "ok",
        "engine": engine,
        "model": model,
        "model_loaded": GROQ_API_KEY != "" or _whisper_model is not None,
    }


@app.post("/transcribe")
async def transcribe_sync(request: Request):
    """Synchronous transcription endpoint for AIM Studio Lite.
    Bearer auth via TRANSCRIPTION_SECRET. Returns { segments } directly.
    """
    auth = request.headers.get("authorization", "")
    if TRANSCRIPTION_SECRET and auth != f"Bearer {TRANSCRIPTION_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    body = await request.json()
    video_url = body.get("url")
    language = body.get("language", "en")
    work_id = body.get("workId", "")

    if not video_url:
        raise HTTPException(status_code=400, detail="url is required")

    if ".m3u8" in video_url.lower():
        raise HTTPException(
            status_code=400,
            detail="HLS playlists are not supported for transcription. Send the original MP4 master source.",
        )

    tmp_dir = tempfile.mkdtemp(prefix="aim_transcribe_")
    try:
        async with _transcription_sem:
            segments, detected_lang = await _download_and_transcribe(video_url, language, tmp_dir)
    except (httpx.HTTPStatusError, ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    log.info(f'"[/transcribe] workId={work_id} lang={detected_lang} segments={len(segments)}"')
    return JSONResponse({
        "segments": [
            {"start": float(s["start"]), "end": float(s["end"]), "text": str(s["text"]).strip()}
            for s in segments
        ]
    })


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
    media_type = payload.get("mediaType", "movie")

    if not job_id or not video_url:
        raise HTTPException(status_code=400, detail="jobId and videoUrl are required")

    if not VERCEL_CALLBACK_URL:
        raise HTTPException(status_code=503, detail="VERCEL_CALLBACK_URL not configured")

    log.info(f'"Accepted job {job_id} for project {project_id}"')
    background_tasks.add_task(_guarded_transcription, job_id, project_id, video_url, language, media_type)

    return JSONResponse({"accepted": True, "jobId": job_id})
