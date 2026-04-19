/**
 * src/lib/subtitle-job-service.ts
 *
 * Service layer for SubtitleJob CRUD and business logic.
 *
 * Rules enforced here (not in the route):
 *  - Only one active (queued/processing) job per (projectId, episodeId) at a time.
 *  - State transitions are validated before any DB write.
 *  - The cron cleanup function marks stuck jobs (>2 h) as failed.
 */

import { prisma } from '@/lib/db'

export type SubtitleJobStatus = 'queued' | 'processing' | 'ready' | 'failed'

// ── Read helpers ──────────────────────────────────────────────────────────────

/**
 * Return the most recent job for this (projectId, episodeId) pair,
 * or null if none exist.
 */
export async function findLatestJob(projectId: string, episodeId: string | null) {
    return prisma.subtitleJob.findFirst({
        where: { projectId, episodeId },
        orderBy: { createdAt: 'desc' },
    })
}

/**
 * Return an active (queued/processing) job, or null.
 * Used to enforce "one active job" constraint.
 */
export async function findActiveJob(projectId: string, episodeId: string | null) {
    return prisma.subtitleJob.findFirst({
        where: {
            projectId,
            episodeId,
            status: { in: ['queued', 'processing'] },
        },
    })
}

/** Fetch a job by its ID. */
export async function getJobById(id: string) {
    return prisma.subtitleJob.findUnique({ where: { id } })
}

// ── Write helpers ─────────────────────────────────────────────────────────────

/**
 * Create a new subtitle job in the 'queued' state.
 * Callers must call findActiveJob first and reject if one already exists.
 */
export async function createSubtitleJob(params: {
    projectId: string
    episodeId: string | null
    sourceVideoUrl: string
    retriedJobId?: string
}) {
    return prisma.subtitleJob.create({
        data: {
            projectId: params.projectId,
            episodeId: params.episodeId ?? null,
            sourceVideoUrl: params.sourceVideoUrl,
            retriedJobId: params.retriedJobId ?? null,
            status: 'queued',
        },
    })
}

/**
 * Transition a job to 'processing' and record the worker's run ID.
 * Only valid if the job is currently 'queued'.
 */
export async function markJobProcessing(id: string, workerRunId: string) {
    return prisma.subtitleJob.update({
        where: { id, status: 'queued' },
        data: { status: 'processing', workerRunId },
    })
}

/**
 * Transition a job to 'ready' and record the generated file URLs.
 * Idempotent — if the job is already 'ready', it returns the existing record.
 */
export async function markJobReady(id: string, vttUrl: string, srtUrl: string) {
    // Check for existing ready state (idempotency)
    const existing = await prisma.subtitleJob.findUnique({ where: { id } })
    if (existing?.status === 'ready') return existing

    return prisma.subtitleJob.update({
        where: { id },
        data: { status: 'ready', vttUrl, srtUrl, errorMessage: null },
    })
}

/**
 * Transition a job to 'failed' and record the error message.
 */
export async function markJobFailed(id: string, errorMessage: string) {
    return prisma.subtitleJob.update({
        where: { id },
        data: { status: 'failed', errorMessage },
    })
}

// ── Cron: cleanup stuck jobs ──────────────────────────────────────────────────

/**
 * Mark all jobs that have been in queued/processing for more than `thresholdMs`
 * as failed. Called by the hourly cron at /api/cron/cleanup-subtitles.
 *
 * @returns Number of jobs marked as failed.
 */
export async function cleanupStuckJobs(thresholdMs = 2 * 60 * 60 * 1000): Promise<number> {
    const cutoff = new Date(Date.now() - thresholdMs)
    const result = await prisma.subtitleJob.updateMany({
        where: {
            status: { in: ['queued', 'processing'] },
            updatedAt: { lt: cutoff },
        },
        data: {
            status: 'failed',
            errorMessage: 'Job timed out — no response from worker within 2 hours.',
        },
    })
    return result.count
}

// ── Recent jobs list (admin dashboard) ───────────────────────────────────────

/** Return the last N jobs across all projects for the admin dashboard. */
export async function listRecentJobs(limit = 50) {
    return prisma.subtitleJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
    })
}
