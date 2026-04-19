/**
 * POST /api/subtitles/generate
 *
 * Admin-only endpoint that triggers the faster-whisper worker to generate
 * subtitles for a project or episode.
 *
 * SECURITY
 * ─────────
 * • Requires admin session (getUserSession + hasAdminRole)
 * • Rate-limited: 5 calls / minute per IP  (subtitle generation is expensive)
 * • HMAC-signed request to the external worker (WORKER_SECRET)
 *
 * IDEMPOTENCY
 * ───────────
 * If a job is already queued or processing for this (projectId, episodeId),
 * the endpoint returns 409 Conflict instead of starting a duplicate job.
 *
 * BODY
 * ────
 * {
 *   projectId:    string   (required)
 *   episodeId?:   string   (optional — null means whole film)
 *   videoUrl:     string   (required — R2 or direct public URL of the video)
 *   language?:    string   (ISO 639-1, e.g. "en", "es" — default "auto")
 * }
 *
 * RESPONSE (200)
 * ──────────────
 * { jobId: string, status: "queued" }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
import { rateLimit } from '@/lib/rate-limit'
import { findActiveJob, createSubtitleJob } from '@/lib/subtitle-job-service'
import { signPayload } from '@/lib/subtitle-worker-hmac'

const limiter = rateLimit({ interval: 60_000, limit: 5 })

export async function POST(req: NextRequest) {
    // ── Auth ────────────────────────────────────────────────────────────────
    const session = await getUserSession()
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasAdminRole(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // ── Rate limit ──────────────────────────────────────────────────────────
    const blocked = limiter.check(req)
    if (blocked) return blocked

    // ── Parse body ──────────────────────────────────────────────────────────
    let projectId: string, videoUrl: string
    let episodeId: string | null = null
    let language = 'auto'

    try {
        const body = await req.json()
        projectId = body.projectId
        videoUrl = body.videoUrl
        episodeId = body.episodeId ?? null
        language = body.language ?? 'auto'
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!projectId || !videoUrl) {
        return NextResponse.json({ error: 'projectId and videoUrl are required' }, { status: 400 })
    }

    // ── Guard: no duplicate active jobs ────────────────────────────────────
    const active = await findActiveJob(projectId, episodeId)
    if (active) {
        return NextResponse.json(
            { error: 'A subtitle job is already in progress for this content.', jobId: active.id, status: active.status },
            { status: 409 }
        )
    }

    // ── Create job row ──────────────────────────────────────────────────────
    const job = await createSubtitleJob({ projectId, episodeId, sourceVideoUrl: videoUrl })

    // ── Call external worker ────────────────────────────────────────────────
    const workerUrl = process.env.WORKER_URL
    if (!workerUrl) {
        console.error('[subtitles/generate] WORKER_URL env var is not set.')
        return NextResponse.json({ error: 'Worker not configured — set WORKER_URL.' }, { status: 503 })
    }

    const payload = { jobId: job.id, projectId, episodeId, videoUrl, language }
    const signature = signPayload(payload)

    try {
        const workerRes = await fetch(`${workerUrl}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Signature': signature,
                // Required to bypass the ngrok browser interstitial page on free-tier tunnels.
                // Safe to include on any host — ignored when the worker is on a real VPS.
                'ngrok-skip-browser-warning': 'true',
            },
            body: JSON.stringify(payload),
            // 10-second connection timeout (not transcription timeout)
            signal: AbortSignal.timeout(10_000),
        })

        if (!workerRes.ok) {
            const workerError = await workerRes.text().catch(() => 'unknown error')
            console.error(`[subtitles/generate] Worker rejected request: ${workerRes.status} ${workerError}`)
            return NextResponse.json(
                { error: `Worker rejected the request: ${workerRes.status}`, jobId: job.id },
                { status: 502 }
            )
        }
    } catch (err) {
        console.error('[subtitles/generate] Failed to reach worker:', err)
        return NextResponse.json(
            { error: 'Could not reach the subtitle worker. Is it running?', jobId: job.id },
            { status: 503 }
        )
    }

    return NextResponse.json({ jobId: job.id, status: 'queued' })
}
