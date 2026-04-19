/**
 * POST /api/admin/subtitle-recover
 *
 * Emergency recovery: manually mark a completed subtitle job as ready
 * and persist its segments to the database.
 *
 * Use this when the worker completes transcription but the callback
 * returns 401 (HMAC mismatch), leaving the job stuck in 'queued' state
 * even though the VTT/SRT are already in R2.
 *
 * SECURITY: Admin session required. No HMAC — this is a privileged operation.
 *
 * BODY
 * ────
 * {
 *   jobId:    string   — the SubtitleJob ID stuck in queued/processing
 *   vttUrl:   string   — R2 public VTT URL from worker logs
 *   srtUrl:   string   — R2 public SRT URL from worker logs
 *   language?: string  — detected language (default 'en')
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
import { getJobById, markJobReady } from '@/lib/subtitle-job-service'
import { upsertSubtitleRecord } from '@/lib/subtitle-status-service'

export async function POST(req: NextRequest) {
    // ── Auth ────────────────────────────────────────────────────────────────
    const session = await getUserSession()
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasAdminRole(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // ── Parse body ──────────────────────────────────────────────────────────
    let jobId: string, vttUrl: string, srtUrl: string, language: string
    try {
        const body = await req.json()
        jobId = body.jobId
        vttUrl = body.vttUrl
        srtUrl = body.srtUrl
        language = body.language ?? 'en'
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (!jobId || !vttUrl || !srtUrl) {
        return NextResponse.json({ error: 'jobId, vttUrl, and srtUrl are required' }, { status: 400 })
    }

    // ── Verify job exists ───────────────────────────────────────────────────
    const job = await getJobById(jobId)
    if (!job) {
        return NextResponse.json({ error: `Job not found: ${jobId}` }, { status: 404 })
    }

    console.info(`[subtitle-recover] Admin recovery for job ${jobId} (${job.status}) → ${vttUrl}`)

    // ── Download VTT and parse segments ────────────────────────────────────
    let segments: { start: number; end: number; text: string }[] = []
    try {
        const vttRes = await fetch(vttUrl)
        if (vttRes.ok) {
            const vttText = await vttRes.text()
            // Parse basic WebVTT: extract cue text and approximate timestamps
            const cues = vttText.split('\n\n').filter(block => block.includes(' --> '))
            segments = cues.map(cue => {
                const lines = cue.trim().split('\n')
                const timeLine = lines.find(l => l.includes(' --> ')) ?? ''
                const [startStr, endStr] = timeLine.split(' --> ')
                const parseVttTime = (t: string) => {
                    const parts = t.trim().split(':').map(Number)
                    return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 0
                }
                const text = lines.filter(l => !l.includes(' --> ') && !/^\d+$/.test(l.trim())).join(' ').trim()
                return { start: parseVttTime(startStr), end: parseVttTime(endStr), text }
            }).filter(s => s.text.length > 0)
        }
    } catch (e) {
        console.warn(`[subtitle-recover] Could not parse VTT for segments: ${e}`)
    }

    // ── Mark job ready ─────────────────────────────────────────────────────
    await markJobReady(jobId, vttUrl, srtUrl)

    // ── Persist transcript to FilmSubtitle ─────────────────────────────────
    if (segments.length > 0) {
        await upsertSubtitleRecord({
            projectId: job.projectId,
            episodeId: job.episodeId,
            language,
            segments: JSON.stringify(segments),
            status: 'completed',
            transcribedWith: 'faster-whisper',
        })
    }

    console.info(`[subtitle-recover] Recovery complete — ${segments.length} segments for project ${job.projectId}`)
    return NextResponse.json({
        ok: true,
        jobId,
        projectId: job.projectId,
        segmentsCount: segments.length,
        vttUrl,
        srtUrl,
    })
}
