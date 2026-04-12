import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logAdminAction } from '@/lib/audit-log'
import { deleteR2Objects } from '@/lib/r2Upload'

export async function POST(req: Request) {
    let session
    try { session = await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const { applicationIds } = await req.json()

        if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
            return NextResponse.json({ error: 'No applications selected' }, { status: 400 })
        }

        // ── Collect media URLs for GDPR-safe R2 cleanup ──────────────────────
        const apps = await prisma.application.findMany({
            where: { id: { in: applicationIds } },
            select: { id: true, headshotPath: true, selfTapePath: true, audioUrl: true },
        })

        // Collect every R2 URL stored across all media fields
        const r2Urls: string[] = []
        for (const app of apps) {
            // headshotPath may be a JSON array of URLs or a single URL string
            if (app.headshotPath) {
                try {
                    const parsed = JSON.parse(app.headshotPath)
                    if (Array.isArray(parsed)) r2Urls.push(...parsed.filter(Boolean))
                    else if (typeof parsed === 'string') r2Urls.push(parsed)
                } catch {
                    r2Urls.push(app.headshotPath)
                }
            }
            // selfTapePath may also be a JSON array
            if (app.selfTapePath) {
                try {
                    const parsed = JSON.parse(app.selfTapePath)
                    if (Array.isArray(parsed)) r2Urls.push(...parsed.filter(Boolean))
                    else if (typeof parsed === 'string') r2Urls.push(parsed)
                } catch {
                    r2Urls.push(app.selfTapePath)
                }
            }
            if (app.audioUrl) r2Urls.push(app.audioUrl)
        }

        // Delete media from R2 (non-blocking — never fails the delete even if R2 errors)
        const r2Result = await deleteR2Objects(r2Urls).catch(() => ({ deleted: 0, failed: r2Urls.length }))

        // ── Delete DB records ──────────────────────────────────────────────────
        const result = await prisma.application.deleteMany({
            where: { id: { in: applicationIds } },
        })

        logAdminAction({
            actor: session.userId,
            action: 'DELETE_APPLICATIONS',
            target: applicationIds.join(','),
            details: { count: result.count, mediaDeleted: r2Result.deleted, mediaFailed: r2Result.failed },
        })

        return NextResponse.json({
            success: true,
            deleted: result.count,
            mediaDeleted: r2Result.deleted,
            message: `${result.count} application(s) permanently deleted`,
        })
    } catch (error) {
        console.error('Bulk delete error:', error)
        return NextResponse.json({ error: 'Failed to delete applications' }, { status: 500 })
    }
}
