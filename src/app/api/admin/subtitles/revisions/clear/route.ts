/**
 * POST /api/admin/subtitles/revisions/clear
 *
 * Allows privileged admins to clear subtitle revision history in a controlled,
 * auditable way. Active subtitle content is NEVER touched unless the admin
 * explicitly chooses `reset_and_clear`.
 *
 * BODY
 * ────
 * {
 *   projectId:      string           (required)
 *   episodeId?:     string | null
 *   action:         'clear_only'         — delete revisions, keep current segments
 *               |   'archive_and_clear'  — return JSON archive then delete revisions
 *               |   'reset_and_clear'    — restore last approved snapshot then delete
 *               |   'delete_drafts'      — delete only manual_edit revisions
 *   reason?:        string           (optional admin note for audit log)
 * }
 *
 * RESPONSE (200)
 * ──────────────
 * { ok: true, rowsDeleted: number, archive?: SubtitleRevision[] }
 *
 * SECURITY
 * ────────
 * Requires admin session. Action is permission-gated (admin role minimum).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
import { prisma } from '@/lib/db'

type ClearAction = 'clear_only' | 'archive_and_clear' | 'reset_and_clear' | 'delete_drafts'
const VALID_ACTIONS: ClearAction[] = ['clear_only', 'archive_and_clear', 'reset_and_clear', 'delete_drafts']

export async function POST(req: NextRequest) {
    // ── Auth ────────────────────────────────────────────────────────────────
    const session = await getUserSession()
    if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasAdminRole(session.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // ── Parse body ──────────────────────────────────────────────────────────
    let projectId: string
    let episodeId: string | null = null
    let action: ClearAction
    let reason: string | undefined

    try {
        const body = await req.json()
        projectId = body.projectId
        episodeId = body.episodeId ?? null
        action = body.action
        reason = body.reason ?? undefined
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!projectId) return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    if (!VALID_ACTIONS.includes(action)) {
        return NextResponse.json({ error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 })
    }

    // ── Load subtitle record ────────────────────────────────────────────────
    const subtitle = await prisma.filmSubtitle.findFirst({
        where: { projectId, episodeId: episodeId ?? null },
        include: { revisions: { orderBy: { savedAt: 'desc' } } },
    })
    if (!subtitle) {
        return NextResponse.json({ error: 'No subtitle record found for this project' }, { status: 404 })
    }

    const revisions = subtitle.revisions
    let archive: typeof revisions | undefined
    let rowsDeleted = 0

    // ── Execute action ──────────────────────────────────────────────────────
    if (action === 'archive_and_clear') {
        // Return full revision archive in response before deleting
        archive = revisions
    }

    if (action === 'reset_and_clear') {
        // Find last revision with changeSource = 'approve' and restore its segments
        const lastApproved = revisions.find(r => r.changeSource === 'approve')
        if (lastApproved) {
            await prisma.filmSubtitle.update({
                where: { id: subtitle.id },
                data: { segments: lastApproved.segmentsSnap },
            })
        }
        // If no approved revision found, leave current segments untouched
    }

    // ── Delete revisions ────────────────────────────────────────────────────
    let whereClause: { subtitleId: string; changeSource?: string } = { subtitleId: subtitle.id }

    if (action === 'delete_drafts') {
        whereClause = { subtitleId: subtitle.id, changeSource: 'manual_edit' }
    }

    const { count } = await prisma.subtitleRevision.deleteMany({ where: whereClause })
    rowsDeleted = count

    // ── Write audit log ─────────────────────────────────────────────────────
    await prisma.subtitleHistoryClear.create({
        data: {
            subtitleId: subtitle.id,
            clearedBy: session.userId,
            clearedByEmail: session.email ?? '',
            clearActionType: action,
            reason: reason ?? null,
            rowsDeleted,
        },
    })

    console.info(
        `[revisions/clear] Admin ${session.email} performed "${action}" on subtitle ${subtitle.id}` +
        ` — ${rowsDeleted} revisions deleted. Reason: ${reason ?? 'none'}`
    )

    return NextResponse.json({ ok: true, rowsDeleted, ...(archive ? { archive } : {}) })
}
