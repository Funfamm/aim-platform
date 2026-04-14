# AIM Studio — Film Translation Engine (Subtitle Pipeline)

> **Last updated:** April 2026  
> **Scope:** Full-movie subtitle generation, multi-language translation, storage, and viewer delivery for all projects and series episodes.

---

## Overview

The film translation engine is a **fully client-side AI pipeline** that runs entirely in the admin's browser — no server GPU required, zero per-request cost. It uses two WASM-based AI runtimes:

| Step | Tool | Model | Size |
|------|------|-------|------|
| Transcription | Transformers.js (Whisper) | `Xenova/whisper-small` | ~244 MB (cached) |
| Translation | Transformers.js (Opus-MT) | `Xenova/opus-mt-en-{lang}` | ~50–80 MB/lang |
| Audio extraction | FFmpeg WASM | `@ffmpeg/core@0.12.6` | ~32 MB (CDN) |

Both model downloads are cached by the browser after the first run. Subsequent subtitle generations are significantly faster.

---

## Architecture

```
Admin browser (admin/projects)
        │
        │ 1. Click "CC" button on project card
        ▼
transcribeVideo()          ← lib/transcribe-client.ts
  FFmpeg WASM extracts audio → 16kHz mono WAV
  Whisper (small) ASR → English segments[]
        │
        │ 2. English transcript + timestamps
        ▼
translateToAllLanguages()  ← lib/subtitle-translator.ts
  For each target language:
    loadPipeline(opus-mt-en-{lang})
    runTranslation(englishSegments)  # batches of 5
        │
        │ 3. { en: [...], es: [...], fr: [...], ... }
        ▼
POST /api/admin/subtitles
  Upserts FilmSubtitle row in DB
  segments = JSON (English track)
  translations = JSON (all other languages)
        │
        │ 4. Confirmed ✅
        ▼
Viewer opens /works/[slug]/watch
WatchPlayer mounts → fetches /api/subtitles/[projectId]?lang=en
  Returns { segments, available: ['en','es','fr',...] }
  Pre-loads English track
  CC button becomes active in player controls
```

---

## File Reference

| File | Role |
|------|------|
| `src/lib/transcribe-client.ts` | FFmpeg WASM audio extraction + Whisper ASR pipeline |
| `src/lib/subtitle-parser.ts` | Parses uploaded SRT/VTT files into `TranscriptSegment[]` |
| `src/lib/subtitle-translator.ts` | Opus-MT model loader + multi-language translation loop |
| `src/app/api/admin/subtitles/route.ts` | Admin POST to save, GET to fetch raw subtitle data |
| `src/app/api/subtitles/[projectId]/route.ts` | Public GET — serves segments + available language list |
| `src/app/admin/projects/page.tsx` | Admin UI — triggers transcription, shows progress bar |
| `src/components/WatchPlayer.tsx` | Viewer UI — CC button, language picker, subtitle overlay |

---

## Database Schema

```prisma
model FilmSubtitle {
  id           String   @id @default(cuid())
  projectId    String
  episodeId    String?              // null = full film, set for series episodes
  language     String   @default("en")
  segments     String               // JSON: TranscriptSegment[]
  translations String?              // JSON: Record<lang, TranscriptSegment[]>
  status       String   @default("pending")  // "pending" | "completed"
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  project      Project  @relation(...)
  @@unique([projectId, episodeId])
}
```

The `translations` field is a single JSON blob containing all language tracks:

```json
{
  "es": [{ "start": 0.5, "end": 3.2, "text": "¿Estás seguro?" }],
  "fr": [{ "start": 0.5, "end": 3.2, "text": "Êtes-vous sûr ?" }],
  ...
}
```

---

## Supported Subtitle Languages

| Code | Language | Opus-MT Model |
|------|----------|---------------|
| `en` | English *(source — from Whisper)* | — |
| `es` | Español | `opus-mt-en-es` |
| `fr` | Français | `opus-mt-en-fr` |
| `de` | Deutsch | `opus-mt-en-de` |
| `pt` | Português | `opus-mt-en-pt` |
| `ru` | Русский | `opus-mt-en-ru` |
| `zh` | 中文 | `opus-mt-en-zh` |
| `ar` | العربية | `opus-mt-en-ar` |
| `ja` | 日本語 | `opus-mt-en-jap` |
| `ko` | 한국어 | `opus-mt-en-ko` |
| `hi` | हिन्दी | `opus-mt-en-hi` |

### Non-English Source Films

If the film is not in English, the pipeline adds an intermediate step:

```
Source lang → English   (SOURCE_TO_EN model, e.g. opus-mt-fr-en)
English     → All other langs  (standard en→X models)
```

This means you only need one source→English model, not N×N models.

---

## Admin Workflow

### Generating Subtitles for a Movie

1. Go to **Admin → Projects**
2. Ensure the project has a `filmUrl` uploaded
3. Click the **CC** button on the project card
4. The progress bar shows phases:
   - `5%` Loading video engine (FFmpeg WASM)
   - `15%` Extracting audio
   - `25%` Loading Whisper model (~244MB first time)
   - `40%` Transcribing audio
   - `50–95%` Translating to each language (Opus-MT)
   - `97%` Saving to database
   - `100%` ✅ Subtitles ready
5. The CC badge updates to show `N/11 langs`

> **Important:** Do not close the browser tab during generation. The pipeline is entirely in-browser — closing the tab cancels it.

### Uploading Existing Subtitles (SRT/VTT)

If you already have subtitle files:
1. The `parseSubtitleFile()` function in `subtitle-parser.ts` accepts SRT or VTT
2. Pass the parsed segments directly to `POST /api/admin/subtitles`

### Series Episodes

Subtitles are scoped per `episodeId`. Each episode needs its own subtitle generation run. The CC button in the admin projects page only appears for the **main film URL**, not episodes — episode subtitle generation is handled from the **Training edit page** (`admin/training/[id]/edit`).

---

## Viewer Workflow (WatchPlayer)

When a logged-in user opens a film:

1. **On mount:** `WatchPlayer` fetches `/api/subtitles/[projectId]?lang=en`
   - If subtitles exist: English track is pre-loaded into memory, `ccAvailable` is populated
   - If no subtitles: `ccAvailable = []`
2. **CC button** is always visible in the player controls (after availability check):
   - 🟡 Dimmed/disabled — no subtitles generated yet
   - ⬜ Available — click once to instantly enable English
   - 🟡 Active — gold highlight, click to turn off
3. **Language picker** (▾ dropdown) appears if >1 language is available
   - Clicking a language fetches that track from `/api/subtitles/[projectId]?lang=es`
   - Already-loaded English is served without a second fetch
4. **Subtitle overlay** renders at the bottom of the video, time-synced via `useMemo` comparison against `currentTime`

---

## API Reference

### `GET /api/subtitles/[projectId]?lang=en&episodeId=xxx`

Public endpoint (auth not required — auth is enforced at the watch *page* level).

**Response:**
```json
{
  "segments": [{ "start": 0.5, "end": 3.2, "text": "Are you sure?" }],
  "language": "en",
  "originalLanguage": "en",
  "available": ["en", "es", "fr", "de", "pt", "ru", "zh", "ar", "ja", "ko", "hi"],
  "status": "completed"
}
```

If no subtitles exist:
```json
{ "segments": null, "available": [] }
```

### `POST /api/admin/subtitles`

Admin-only. Creates or updates the `FilmSubtitle` record.

```json
{
  "projectId": "...",
  "episodeId": null,
  "language": "en",
  "segments": [...],
  "translations": { "es": [...], "fr": [...] },
  "status": "completed"
}
```

---

## Known Limitations & Gotchas

| Issue | Details |
|-------|---------|
| **Browser tab must stay open** | The entire pipeline runs in the admin's browser. Closing the tab cancels generation. |
| **First download is slow** | Whisper (~244MB) + each Opus-MT model (~50–80MB each) download on first use. Cached after that. |
| **Whisper accuracy** | `whisper-small` is good but not perfect. Complex accents or heavy background music reduce accuracy. Use `whisper-medium` (not yet implemented) for higher quality. |
| **Opus-MT quality** | Neural-MT quality is good for European languages but lower for Arabic, Japanese, Korean, Hindi. May need human review for those tracks. |
| **CORS on video URL** | `fetchFile(videoUrl)` fetches the R2 video URL cross-origin. R2 CORS must allow `GET` from the platform domain. |
| **No retry on partial failure** | If translation fails mid-run (e.g., one language times out), the batch is not retried. Re-clicking CC regenerates from scratch. |

---

## Adding a New Language

1. Add the entry to `EN_TO_TARGET` in `subtitle-translator.ts`:
   ```ts
   tr: 'Xenova/opus-mt-en-tr', // Turkish
   ```
2. Add the reverse model to `SOURCE_TO_EN` if you need Turkish-source films
3. Add to `LANGUAGE_NAMES`:
   ```ts
   tr: 'Türkçe',
   ```
4. The new language will automatically appear in the viewer's CC dropdown once subtitles are regenerated
