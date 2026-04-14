# LiveKit Realtime Layer — AIM Studio / impactaistudio.com

## The Permanent Architecture Decision

**Vercel for product + LiveKit for realtime + isolated workers for captions/translation + isolated egress for recording/broadcast**

```text
Browser / Mobile client
   ↓
Vercel — Next.js app, auth, dashboard, admin, token APIs, webhooks
   ↓
LiveKit — rooms, audio, video, screenshare, text streams
   ↓
Workers
   ├─ transcription worker  (Whisper STT)
   ├─ translation worker    (Gemini adapter)
   └─ egress worker         (MP4 / HLS / RTMP)
```

**Platform use cases:**
- 🎭 **Live Auditions** — talent auditions remotely for open casting calls
- 🎬 **Live Events** — premieres, cast Q&A sessions, director talks
- 🎉 **Watch Parties** — synchronized viewing with live commentary

---

## Step 0: LiveKit Cloud Setup (before any code runs in production)

> [!IMPORTANT]
> **Use LiveKit Cloud for Phase 1.** No server to manage. Instant HTTPS/WSS endpoint with built-in TURN/TLS.
> Migrate to self-hosted in Phase 5 when usage justifies cost.

### Actions required by you (not code):

**1. Create LiveKit Cloud project**
- Go to [cloud.livekit.io](https://cloud.livekit.io) → New Project → name it `aim-studio-prod`
- Copy your `wss://` WSS URL, API Key, API Secret, and Webhook Secret

**2. DNS records at your registrar (impactaistudio.com)**

| Subdomain | Type | Points to |
|---|---|---|
| `app` | CNAME | `cname.vercel-dns.com` |
| `rtc` | CNAME | Your LiveKit Cloud WSS hostname (from dashboard) |
| `media` | CNAME | R2 / HLS delivery (Phase 4) |
| `events` | CNAME | Webhook processor host (Phase 3+) |

> [!NOTE]
> LiveKit TURN/TLS is included on LiveKit Cloud — all ports and fallback connectivity are handled for you. On Phase 5 self-hosted you will need to open: HTTPS/TLS endpoint, TURN/TLS port, TCP fallback, and UDP media range (50000–60000). Do NOT treat TURN/TLS as optional — it is essential for corporate/restrictive networks.

**3. Add `app.impactaistudio.com` as a custom domain in Vercel** (Project → Settings → Domains)

**4. Vercel env vars (Production + Preview)**

```bash
# LiveKit
LIVEKIT_URL=wss://rtc.impactaistudio.com
LIVEKIT_API_KEY=<from LiveKit Cloud>
LIVEKIT_API_SECRET=<from LiveKit Cloud>
LIVEKIT_WEBHOOK_KEY=<from LiveKit Cloud webhook settings>
LIVEKIT_WEBHOOK_SECRET=<from LiveKit Cloud webhook settings>

# App URLs
APP_URL=https://app.impactaistudio.com
NEXT_PUBLIC_APP_URL=https://app.impactaistudio.com
INTERNAL_EVENTS_URL=https://events.impactaistudio.com

# Caption / Translation feature flags
CAPTIONS_DEFAULT_LANG=en
TRANSLATION_ENABLED=true
```

**5. Worker plane env vars (Railway / Fly.io service)**

```bash
# LiveKit (separate key-pair from app — isolate worker credentials)
LIVEKIT_URL=wss://rtc.impactaistudio.com
LIVEKIT_API_KEY=<worker-specific key>
LIVEKIT_API_SECRET=<worker-specific secret>

# STT / Translation
STT_PROVIDER=whisper
TRANSLATION_PROVIDER=adapter
DEFAULT_SOURCE_LANG=auto

# Storage (reuse existing R2 setup)
STORAGE_BUCKET=<r2-bucket-name>
STORAGE_REGION=auto
STORAGE_ACCESS_KEY=<r2-access-key>
STORAGE_SECRET_KEY=<r2-secret-key>
```

---

## Phase 1 — Secure Backend Foundation

All files below. No live UI yet — TypeScript-clean backend only.

### Folder structure delivered in Phase 1

```text
src/
  app/
    api/
      livekit/
        token/route.ts          ← POST: mint room token
      webhooks/
        livekit/route.ts        ← POST: signed webhook receiver
      rooms/
        create/route.ts         ← POST: admin creates room + DB record
        end/route.ts            ← POST: admin ends room
      captions/
        preferences/route.ts    ← GET/PUT: per-user caption language preference
  components/
    live/                       ← (Phase 2 — UI shell)
  lib/
    auth/                       ← existing auth helpers
    livekit/
      server.ts                 ← AccessToken factory + RoomServiceClient
      grants.ts                 ← Role → VideoGrant builder
      permissions.ts            ← canJoinRoom() DB guard
      webhook.ts                ← WebhookReceiver wrapper
      translation-adapter.ts    ← TranslationAdapter interface + CAPTION_TOPICS
    telemetry/
      instrumentation.ts        ← OTel provider/exporter setup (imported by root)
    db/                         ← existing Prisma client
  instrumentation.ts            ← Next.js root instrumentation hook (calls telemetry/)
prisma/
  schema.prisma                 ← Add LiveEvent model
```

---

### Phase 1 Security Checklist

All 10 rules enforced from day one:

- [x] Token minting **only on the backend** (`/api/livekit/token`)
- [x] **Short TTL** — 10 minutes, re-fetched on reconnect
- [x] **Role-based grants** — admin / host / speaker / viewer model
- [x] **No LiveKit secret in the browser** — never in `NEXT_PUBLIC_*`
- [x] **Webhook signature verification** — `WebhookReceiver.receive()`
- [x] **Secrets in Vercel env vars** — encrypted at rest, not in code
- [x] **Separate worker credentials** — worker has its own API key-pair
- [x] **Recording/translation permissions** handled separately from room join
- [x] **`canJoinRoom()` DB guard** before every token mint
- [x] **Admin-only** create/end room endpoints via `requireAdmin()`

---

### Files

#### [NEW] `src/lib/livekit/server.ts`
`createAccessToken()` + `getRoomServiceClient()`. Single SDK import point.

#### [NEW] `src/lib/livekit/grants.ts`
`grantsForRole(role, roomName)` returns typed `VideoGrant`.

| Role | Publish | Subscribe | Room Admin | Record |
|---|---|---|---|---|
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `host` | ✅ | ✅ | ❌ | ❌ |
| `speaker` | ✅ | ✅ | ❌ | ❌ |
| `viewer` | ❌ | ✅ | ❌ | ❌ |

#### [NEW] `src/lib/livekit/permissions.ts`
`canJoinRoom(userId, roomName, role, isAdmin)` — DB guard before token is minted.

#### [NEW] `src/lib/livekit/webhook.ts`
`receiveLiveKitWebhook(rawBody, authHeader)` — typed + signature-verified.

#### [NEW] `src/lib/livekit/translation-adapter.ts`
Defines the `TranslationAdapter` interface and caption topic constants:

```ts
export interface TranslationAdapter {
  translate(input: {
    text: string
    sourceLang: string
    targetLang: string
    roomName: string
    participantIdentity: string
  }): Promise<{ translatedText: string; sourceLang: string; targetLang: string }>
}

export const CAPTION_TOPICS = {
  original: 'captions.original',
  en: 'captions.en',
  ar: 'captions.ar',
  de: 'captions.de',
  es: 'captions.es',
  fr: 'captions.fr',
  hi: 'captions.hi',
  ja: 'captions.ja',
  ko: 'captions.ko',
  pt: 'captions.pt',
  ru: 'captions.ru',
  zh: 'captions.zh',
} as const
```

#### [NEW] `src/app/api/livekit/token/route.ts`
POST — auth-gated, validates roomName + role, calls `canJoinRoom()`, mints 10-min token.  
Returns `{ token, wsUrl, roomName, identity, role }`.

#### [NEW] `src/app/api/livekit/rooms/create/route.ts`
POST — `requireAdmin()` only. Creates LiveKit room via RoomServiceClient + writes `LiveEvent` to DB.

#### [NEW] `src/app/api/livekit/rooms/end/route.ts`
POST — `requireAdmin()` only. Closes room + sets `LiveEvent.status = ended`.

#### [NEW] `src/app/api/webhooks/livekit/route.ts`
POST — raw body + signature verification. Handles:
- `room_started` → `LiveEvent.status = live`, `startedAt = now()`
- `room_finished` → `LiveEvent.status = ended`, `endedAt = now()`
- `participant_joined` / `participant_left` → analytics log
- `egress_started` / `egress_updated` / `egress_ended` → EgressRecord update

#### [NEW] `src/app/api/captions/preferences/route.ts`
GET — returns the authenticated user's preferred caption language.  
PUT `{ lang: 'es' }` — saves preference on the User record (`preferredLanguage`).

#### [NEW] `src/instrumentation.ts`
OpenTelemetry bootstrap following Next.js `instrumentation.ts` convention.  
Tracks these 9 metrics from day one:

| Metric | Description |
|---|---|
| `livekit.token.success` / `.failure` | Token endpoint outcome |
| `livekit.room.join_latency_ms` | Time from token fetch to `connected` event |
| `livekit.room.reconnect_count` | Per-session reconnection events |
| `livekit.captions.lag_ms` | Delta: speech end → caption render |
| `livekit.translation.lag_ms` | Delta: source caption → translated caption |
| `livekit.webhook.verification_failure` | Rejected webhook payloads |
| `livekit.egress.failure_rate` | Start/end job failures |
| `livekit.captions.lang_usage` | Per-language caption selections |
| `livekit.turn.fallback_rate` | Sessions that fell back to TURN relay |

#### [MODIFY] `prisma/schema.prisma`
Add `LiveEvent` + relation back to `Project`:

```prisma
model LiveEvent {
  id          String    @id @default(cuid())
  title       String
  roomName    String    @unique
  status      String    @default("scheduled") // scheduled | live | ended
  eventType   String    @default("general")   // general | audition | q_and_a | watch_party
  startedAt   DateTime?
  endedAt     DateTime?
  hostUserId  String
  projectId   String?
  castingCallId String? // for audition rooms — ties room to a specific CastingCall
  recordingUrl  String? // set by egress worker after recording completes
  project     Project?    @relation(fields: [projectId], references: [id])
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([status])
  @@index([hostUserId])
  @@index([projectId])
}
```

---

## Phase 2 — Room UI Shell

#### [NEW] `src/components/live/RoomShell.tsx`
`'use client'` — fetches token, renders `<LiveKitRoom>` with `audio`, `video`, `connect`.

#### [NEW] `src/components/live/ParticipantGrid.tsx`
`useTracks()` grid — video tiles for all participants.

#### [NEW] `src/components/live/CaptionOverlay.tsx`
Subscribes to `CAPTION_TOPICS[selectedLang]` text stream, renders over video.

#### [NEW] `src/components/live/LanguageSelector.tsx`
Dropdown that reads user preference via `GET /api/captions/preferences`, saves via `PUT`.

#### [NEW] `src/app/[locale]/events/[roomName]/page.tsx`
Public-facing event page. `RoomShell` for authenticated users, teaser card for guests.

#### [NEW] `src/app/admin/events/page.tsx`
Admin panel: list events, create, end, view live participant count, link to project/casting call.

---

## Phase 3 — Captions + Translation Workers

Separate Node.js services deployed on Railway or Fly.io:

```text
Speaker audio
  → STT worker (subscribe to room audio tracks via LiveKit SDK)
  → normalize transcript segments + timestamps
  → publish to captions.original (text stream topic)
  → Translation worker reads captions.original
  → GeminiTranslationAdapter.translate() for each target language
  → publish to captions.en, captions.ar, captions.es … captions.zh (11 topics)
  → CaptionOverlay in viewer's browser renders selected language channel
```

Workers live in `workers/caption-worker/` (monorepo or separate repo).  
Worker credentials are **separate** from the Vercel app API key.

---

## Phase 4 — Egress (Recording + HLS)

- Admin triggers MP4 / HLS / RTMP export from the events control panel
- `POST /api/livekit/rooms/egress/start` → calls LiveKit Egress API
- Completed recordings → uploaded to existing R2 bucket
- `EgressRecord` DB model tracks job state (starting → active → complete / failed)
- Webhook `egress_ended` fires → Vercel webhook handler updates record + notifies admin

---

## Phase 5 — Self-Hosted LiveKit at Scale

- Provision Ubuntu 22.04 VPS (2+ cores, 4GB+ RAM)
- Deploy LiveKit server + TURN server via Docker Compose
- Add Redis for distributed room state and multi-node clustering
- Open ports: 443 (HTTPS/TLS), 3478/5349 (TURN/STUN), 7881 (TCP fallback), 50000–60000 (UDP media)
- Update `rtc.impactaistudio.com` CNAME → VPS IP (A record)
- Update `LIVEKIT_URL` env var in Vercel + workers

---

## Verification Plan

### Phase 1
- `npx tsc --noEmit` → zero errors
- `POST /api/livekit/token` without session → 401
- `POST /api/livekit/token` with valid session + roomName → 200 + JWT
- `POST /api/webhooks/livekit` with bad signature → 401
- `POST /api/webhooks/livekit` with valid signature → 200

### Phase 2 (browser)
- Join test room as host → video tile appears, audio works
- Join same room as viewer → cannot publish, can see host
- Switch language selector → preference saved, caption topic switches

### Phase 3 (integration)
- Speak in room → `captions.original` appears within 2s
- Translation → `captions.es` appears within 4s of speech
- TURN fallback → simulate UDP-blocked network, confirm session stays connected

---

## Open Question

> [!NOTE]
> **Audition rooms** — should the `castingCallId` field on `LiveEvent` auto-restrict token minting so only the specific applicant + admins can join? This is the premium approach for private remote auditions. Confirm before Phase 2 to lock the permission model.
