# Vercel-Safe Subtitle Generation Guidance

## Goal
Build subtitle generation for admin-uploaded movies **without**:
- paying for AI API keys
- running heavy transcription inside Vercel
- risking overage from Vercel Pro monthly usage
- triggering browser ONNX / WASM subtitle errors

---

## 1) Highest-priority recommendation

### Keep Vercel as the web platform, not the subtitle compute engine
Use Vercel for:
- admin dashboard
- movie upload workflow
- metadata storage
- subtitle status display
- serving the public site and player

Do **not** use Vercel Functions to do:
- full video download + processing
- ffmpeg extraction
- Whisper inference
- long-running subtitle generation jobs

### Why
Heavy subtitle generation is CPU- and memory-intensive. Even if it works, it is the kind of workload most likely to consume your Vercel monthly usage. Since your goal is to stay under quota, the safest design is to move transcription outside Vercel.

---

## 2) Best architecture for your situation

### Recommended architecture

#### Vercel side
- admin uploads movie
- app stores movie record and video URL
- app triggers subtitle request to external worker
- app receives subtitle result or worker callback
- app saves VTT/SRT to movie record or storage
- player loads VTT track automatically

#### External worker side
- downloads uploaded video from its URL
- extracts speech audio
- runs local subtitle engine
- generates `.srt` and `.vtt`
- returns result to your app or uploads subtitle files directly

### Why this is the best fit
This gives you:
- no paid AI key requirement
- much lower Vercel usage
- no browser model-loading issues
- more control over cost
- a cleaner admin publishing workflow

---

## 3) How not to exceed your monthly Vercel quota

### A. Set spend protection first
In Vercel:
1. Open **Team Settings**
2. Open **Spend Management**
3. Set a monthly spend ceiling you are comfortable with
4. Enable notifications
5. Enable **Pause production deployment** if you want a hard stop

### B. Keep subtitle generation outside Vercel
This is the biggest protection.

### C. Never send raw video through a Vercel Function
Always:
- upload video to storage first
- pass only the stored `videoUrl` to the worker

### D. Make subtitle generation admin-only
Do not let public users trigger subtitle jobs.

### E. Prevent duplicate runs
For each movie:
- allow only one active subtitle job at a time
- disable repeat clicks while a job is running
- do not regenerate if subtitles already exist unless admin chooses retry

### F. Add daily and monthly caps
Suggested limits:
- max 3 subtitle generations per day
- max 20 per month until you observe actual usage

### G. Save results permanently
Once subtitles are generated:
- store the VTT/SRT
- reuse them forever
- only regenerate if the source video changes

### H. Prefer manual retry over automatic retry loops
Automatic retries can quietly consume usage. Better pattern:
- first failure: mark failed
- show admin a retry button
- only retry automatically once if you must

---

## 4) Best subtitle engine if you do not want paid AI keys

### First recommendation: `faster-whisper`
Use `faster-whisper` for your external worker.

Why:
- local inference
- no API key cost
- works on CPU or GPU
- good speed/quality balance
- returns timestamped segments
- practical for building VTT/SRT

### Good starting model choice
- `base` for weaker machines
- `small` for better quality if your machine can handle it

### Compute guidance
- weak machine: `base`
- decent CPU: `small`
- GPU available: `small` or higher

### Second recommendation: `whisper.cpp`
Use this if you want a very lightweight CPU-oriented setup.

Why:
- lightweight
- good for Windows
- simple CLI use
- can directly output SRT/VTT

### Recommendation summary
- easiest flexible build: **faster-whisper**
- simplest CPU-focused binary style: **whisper.cpp**

---

## 5) Where the worker should run

### Best low-cost options

#### Option 1 — your own PC
Best if:
- only admin uploads movies
- subtitle generation is occasional
- your PC can stay online when needed

Pros:
- lowest cost
- full control
- no extra hosting bill

Cons:
- worker only available when your machine is on

#### Option 2 — small VPS
Best if:
- you want more consistent uptime
- you want subtitle generation anytime
- you want cleaner separation from your personal machine

Pros:
- reliable availability
- still cheaper than heavy Vercel compute or paid transcription APIs

Cons:
- small monthly VPS cost

### Recommendation
Start with your own PC if volume is low. Move to a VPS later if usage grows.

---

## 6) Admin flow you should use

### Flow
1. Admin uploads movie
2. Movie file is stored
3. App creates/updates movie record
4. App triggers subtitle job externally
5. Worker generates subtitles
6. App stores subtitle result
7. Movie player loads VTT automatically

### Admin UI fields to support
- movie title
- description
- original language
- video upload or external video URL
- subtitle status
- retry subtitle generation button
- upload manual subtitle override button
- delete/regenerate subtitle button

### Status values
Use something simple:
- `pending`
- `processing`
- `ready`
- `failed`

---

## 7) Public player behavior

Public users should **not** generate subtitles.

They should only:
- watch movie
- automatically receive subtitles if available

### Player behavior
- if VTT exists, attach it as `<track kind="subtitles">`
- if no subtitle exists, just play video normally
- optionally allow subtitle toggle on/off in the player UI

---

## 8) Why browser subtitle generation should not be your main system

Your earlier issue came from browser-side model loading and runtime initialization. That kind of setup is fragile because it depends on:
- correct WASM files
- correct model file paths
- browser runtime support
- client machine performance
- network availability to fetch model/runtime files

### Main recommendation
Do **not** make browser transcription your production subtitle system.

### Acceptable use of browser transcription
Only keep it as:
- a fallback experiment
- a dev/testing tool
- a last resort, not your primary pipeline

---

## 9) Core implementation pattern

### Vercel app responsibilities
- store movie record
- store video URL
- trigger worker request
- receive result
- save subtitle content or URLs
- render subtitle status

### Worker responsibilities
- download source video
- extract audio
- transcribe locally
- create SRT
- create VTT
- return data back

### Important rule
**Movie upload should succeed even if subtitle generation fails.**

Subtitle generation should be a separate background or follow-up step, not something that can block the entire movie upload.

---

## 10) Guardrails to keep the system solid

### A. One job per movie at a time
Do not start another job if one is already processing.

### B. Store subtitle hash or source version
If the video file did not change, do not regenerate.

### C. Add timeout and error handling on the worker
If transcription fails:
- mark subtitle status as `failed`
- show error in admin
- allow retry

### D. Keep manual override support
Admin should always be able to:
- upload a custom `.srt`
- upload a custom `.vtt`
- replace machine-generated captions

### E. Keep subtitle generation separate from public watch analytics
Do not mix subtitle processing with playback requests.

---

## 11) Recommended storage pattern

### Movie record should store at least
- `videoUrl`
- `language`
- `subtitleStatus`
- `subtitleVttUrl` or `subtitleVtt`
- `subtitleSrtUrl` or `subtitleSrt`

### Better approach
Store subtitle files in object storage and save only their URLs in the database.

Why:
- cleaner DB
- easier downloads
- easier replacement
- less row bloat

---

## 12) Suggested database fields

### Movie table additions
- `subtitleStatus`
- `subtitleVttUrl`
- `subtitleSrtUrl`
- `subtitleError`
- `subtitleLanguage`
- `subtitleGeneratedAt`

### Optional subtitle_jobs table
Use if you want tracking.

Fields:
- `id`
- `movieId`
- `status`
- `sourceVideoUrl`
- `errorMessage`
- `createdAt`
- `updatedAt`

If your flow is simple and admin-only, you can keep everything directly on the movie record at first.

---

## 13) Best first version to build

### Phase 1 — simplest usable version
- admin uploads movie
- app saves movie
- app calls local worker with `videoUrl`
- worker returns `srt` and `vtt`
- app saves result on movie record
- player uses VTT

### Why this is best first
It is simple, cheap, and gives you a working end-to-end system quickly.

### Phase 2 — stronger version
Later add:
- subtitle job queue
- job history
- retry tracking
- manual subtitle override uploads
- transcript preview in admin
- subtitle editing UI

---

## 14) What not to do

Avoid these if your goal is low cost and stability:
- running full subtitle generation inside Vercel Functions
- sending raw movie files through Vercel API routes
- depending on paid AI transcription APIs
- using browser ONNX/WASM as the main subtitle engine
- allowing end users to trigger subtitle generation
- auto-regenerating subtitles every time the movie is edited unless the source video changed

---

## 15) Recommended technical path

### Best overall recommendation
**Vercel app + self-hosted faster-whisper worker**

This is the best balance of:
- low cost
- no paid key
- production reliability
- no browser subtitle errors
- low Vercel usage

### Best fallback recommendation
If you want something lighter or more CLI-focused:
**Vercel app + whisper.cpp worker**

---

## 16) Practical worker recommendation for you

### If you want easiest next step
Use:
- Windows machine or VPS
- Python FastAPI worker
- `faster-whisper`
- admin-triggered generation only

### Why
This is practical, flexible, and easy to integrate with your current platform.

---

## 17) Final decision guide

### Choose this if your priority is lowest cost
- self-host worker on your PC
- use `faster-whisper`
- store results once
- no paid keys

### Choose this if your priority is better uptime
- use a small VPS worker
- still use `faster-whisper`
- keep Vercel only for the web app

### Do not choose this if your priority is low spend
- Whisper in Vercel Functions
- ffmpeg inside Vercel for full videos
- browser transcription as your main engine

---

## 18) Short final recommendation

For your exact situation:

1. Keep your existing admin upload flow.
2. Do not run subtitle generation inside Vercel.
3. Run a self-hosted subtitle worker instead.
4. Use `faster-whisper` first.
5. Pass only the uploaded `videoUrl` to the worker.
6. Save VTT/SRT once and reuse them.
7. Add spend limits and pause rules in Vercel.
8. Keep subtitle generation admin-only and retry manually when needed.

This is the safest path to get subtitles working without paid AI keys and without pushing past your Vercel monthly usage.

---

## 19) Optional next build steps

If you continue from here, the next concrete deliverables should be:
- Windows local worker setup guide
- `faster-whisper` worker code
- Next.js route or admin action that calls the worker
- movie record update logic
- player subtitle track integration
- retry and status UI in admin

