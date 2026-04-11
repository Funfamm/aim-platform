/**
 * audit-queue.ts
 *
 * FIFO + priority queue manager for AI application auditing.
 *
 * State machine for Application.auditState:
 *   null / undefined  → not yet queued (legacy or pre-enqueue)
 *   'queued'          → waiting for an available AI key
 *   'processing'      → cron currently scoring this application
 *   'scored_hidden'   → AI result stored, awaiting resultVisibleAt reveal window
 *   'scored_visible'  → result visible to applicant
 *   'failed'          → scoring failed after max attempts
 */

import { prisma } from '@/lib/db'

const STUCK_TIMEOUT_MINUTES = 15  // jobs stuck in 'processing' for longer are reset
const MAX_ATTEMPTS = 3             // give up after this many failures

/** Queue an application for AI scoring (idempotent — safe to call again on reapply). */
export async function enqueueApplication(
    applicationId: string,
    priority = 0
): Promise<void> {
    await (prisma.application as any).update({
        where: { id: applicationId },
        data: {
            auditState: 'queued',
            queuedAt: new Date(),
            priority,
            lastProcessingError: null,
        },
    })
    console.log(`[AuditQueue] Enqueued ${applicationId} (priority=${priority})`)
}

/**
 * Returns up to `limit` applications that are ready to be scored.
 * Ordered by priority DESC then queuedAt ASC (FIFO within the same priority).
 */
export async function getNextBatch(limit: number): Promise<Array<Record<string, any>>> {
    return (prisma.application as any).findMany({
        where: { auditState: 'queued' },
        include: {
            castingCall: { include: { project: true } },
        },
        orderBy: [
            { priority: 'desc' },
            { queuedAt: 'asc' },
        ],
        take: limit,
    })
}

/** Mark an application as currently being processed. */
export async function markProcessing(applicationId: string): Promise<void> {
    await (prisma.application as any).update({
        where: { id: applicationId },
        data: {
            auditState: 'processing',
            processingAttempts: { increment: 1 },
        },
    })
}

/**
 * Store the AI result and set the reveal timer.
 * The result stays hidden until resultVisibleAt is reached (or adminRevealOverride = true).
 */
export async function markScoredHidden(
    applicationId: string,
    revealDelayHours: number,
    extraData: Record<string, unknown> = {}
): Promise<void> {
    const aiScoredAt = new Date()
    const resultVisibleAt = new Date(aiScoredAt.getTime() + revealDelayHours * 60 * 60 * 1000)
    await (prisma.application as any).update({
        where: { id: applicationId },
        data: {
            auditState: 'scored_hidden',
            aiScoredAt,
            resultVisibleAt,
            ...extraData,
        },
    })
}

/**
 * Flip a scored_hidden application to scored_visible and clear the reveal fields.
 * Called by the second pass of the cron once resultVisibleAt has passed.
 */
export async function markScoredVisible(applicationId: string): Promise<void> {
    await (prisma.application as any).update({
        where: { id: applicationId },
        data: { auditState: 'scored_visible' },
    })
}

/** Record a scoring failure. Gives up (marks as 'failed') after MAX_ATTEMPTS. */
export async function markFailed(applicationId: string, error: string): Promise<void> {
    const app = await (prisma.application as any).findUnique({
        where: { id: applicationId },
        select: { processingAttempts: true },
    })
    const attempts = app?.processingAttempts ?? 1
    const nextState = attempts >= MAX_ATTEMPTS ? 'failed' : 'queued'

    await (prisma.application as any).update({
        where: { id: applicationId },
        data: {
            auditState: nextState,
            lastProcessingError: error.slice(0, 500),
        },
    })
    console.log(`[AuditQueue] ${applicationId} → ${nextState} after ${attempts} attempt(s): ${error}`)
}

/**
 * Crash-recovery: reset any applications that have been stuck in 'processing'
 * for longer than STUCK_TIMEOUT_MINUTES back to 'queued'.
 */
export async function releaseStuck(): Promise<number> {
    const cutoff = new Date(Date.now() - STUCK_TIMEOUT_MINUTES * 60 * 1000)
    const result = await (prisma.application as any).updateMany({
        where: {
            auditState: 'processing',
            updatedAt: { lte: cutoff },
        },
        data: {
            auditState: 'queued',
            lastProcessingError: 'Reset after stuck-job timeout',
        },
    })
    if (result.count > 0) {
        console.log(`[AuditQueue] Released ${result.count} stuck job(s)`)
    }
    return result.count
}

/**
 * Returns all scored_hidden applications whose resultVisibleAt has passed.
 * Used by the second pass of the cron to flip them visible and send notifications.
 */
export async function getDueForReveal(): Promise<Array<Record<string, any>>> {
    return (prisma.application as any).findMany({
        where: {
            auditState: 'scored_hidden',
            resultVisibleAt: { lte: new Date() },
            adminRevealOverride: false, // already flipped by admin if true
        },
        select: {
            id: true,
            email: true,
            fullName: true,
            aiScore: true,
            statusNote: true,
            status: true,
            locale: true,
            resultVisibleAt: true,
            castingCall: {
                select: {
                    roleName: true,
                    project: { select: { title: true } },
                },
            },
            user: { select: { id: true } },
        },
    })
}
