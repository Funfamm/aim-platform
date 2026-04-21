/**
 * POST /api/subtitles/callback
 *
 * Webhook called by the faster-whisper worker when transcription completes
 * (success or failure).
 *
 * SECURITY
 * ─────────
 * • Verified via HMAC-SHA256 signature (`X-Signature` header, keyed on WORKER_SECRET).
 * • No admin session required — the HMAC IS the auth.
 * • NOT rate-limited (the worker should only call this once per job).
 *
 * IDEMPOTENCY
 * ───────────
 * If the callback arrives a second time for the same jobId (e.g. worker retry),
 * the handler is idempotent — markJobReady returns the existing record unchanged.
 *
 * SUCCESS BODY from worker
 * ─────────────────────────
 * {
 *   jobId:       string
 *   workerRunId: string    // opaque worker-internal run ID for tracing
 *   vttUrl:      string    // public R2 URL of the generated .vtt
 *   srtUrl:      string    // public R2 URL of the generated .srt
 *   segments:    TranscriptSegment[]   // optional — saved to FilmSubtitle
 *   language:    string    // detected ISO 639-1 language code
 * }
 *
 * FAILURE BODY from worker
 * ─────────────────────────
 * {
 *   jobId:        string
 *   workerRunId?: string
 *   error:        string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySignature } from '@/lib/subtitle-worker-hmac'
import { getJobById, markJobReady, markJobFailed, markJobProcessing } from '@/lib/subtitle-job-service'
import { upsertSubtitleRecord } from '@/lib/subtitle-status-service'

export async function POST(req: NextRequest) {
    // ── Read raw body for signature verification ────────────────────────────
    const rawBody = await req.text()
    const signature = req.headers.get('x-signature')

    // ── Diagnostic fingerprints ──────────────────────────────────────────────
    const rawSecret = (process.env.WORKER_SECRET ?? '').trim().replace(/^["']|["']$/g, '')
    const secretFp = rawSecret.length > 8
        ? `${rawSecret.slice(0, 4)}…${rawSecret.slice(-4)} (${rawSecret.length} chars)`
        : rawSecret.length === 0 ? '(empty!)' : '(too short)'
    console.info(`[subtitles/callback] WORKER_SECRET fingerprint: ${secretFp} | body length: ${rawBody.length} | provided sig: ${signature?.slice(0, 8) ?? 'none'}…`)

    if (!verifySignature(rawBody, signature)) {
        console.warn(`[subtitles/callback] HMAC MISMATCH — secret: ${secretFp} | body[0..80]: ${rawBody.slice(0, 80)}`)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Parse payload ───────────────────────────────────────────────────────
    let payload: Record<string, unknown>
    try {
        payload = JSON.parse(rawBody)
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { jobId, workerRunId, vttUrl, srtUrl, segments, language, error } = payload as {
        jobId?: string
        workerRunId?: string
        vttUrl?: string
        srtUrl?: string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        segments?: any[]
        language?: string
        error?: string
    }

    if (!jobId) {
        return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
    }

    // ── Verify job exists ───────────────────────────────────────────────────
    const job = await getJobById(jobId)
    if (!job) {
        console.warn(`[subtitles/callback] Unknown jobId: ${jobId}`)
        return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // ── Transition to processing (if worker is calling mid-run) ────────────
    if (job.status === 'queued' && workerRunId && !vttUrl && !error) {
        await markJobProcessing(jobId, workerRunId)
        return NextResponse.json({ ok: true, status: 'processing' })
    }

    // ── Failure path ────────────────────────────────────────────────────────
    if (error) {
        console.error(`[subtitles/callback] Worker reported failure for job ${jobId}: ${error}`)
        await markJobFailed(jobId, String(error))
        return NextResponse.json({ ok: true, status: 'failed' })
    }

    // ── Success path ────────────────────────────────────────────────────────
    if (!vttUrl || !srtUrl) {
        return NextResponse.json({ error: 'vttUrl and srtUrl are required on success' }, { status: 400 })
    }

    // Mark the job as ready (idempotent)
    await markJobReady(jobId, vttUrl, srtUrl)

    // Persist the transcript segments to FilmSubtitle so the existing
    // translation pipeline can pick them up immediately.
    if (segments && segments.length > 0) {
        try {
            await upsertSubtitleRecord({
                projectId: job.projectId,
                episodeId: job.episodeId,
                language: language ?? 'en',
                originalLanguage: language ?? 'en', // write detected source language
                segments: JSON.stringify(segments),
                status: 'completed',
                transcribedWith: 'faster-whisper',
            })
        } catch (err) {
            // Non-fatal — the VTT URL is already saved. Log and continue.
            console.error('[subtitles/callback] Failed to persist segments to FilmSubtitle:', err)
        }
    }

    console.info(`[subtitles/callback] Job ${jobId} completed → ${vttUrl}`)
    return NextResponse.json({ ok: true, status: 'ready' })
}
