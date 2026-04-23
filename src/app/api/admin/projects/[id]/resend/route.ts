import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notifyContentPublish } from '@/lib/notifications'

/**
 * POST /api/admin/projects/[id]/resend
 *
 * Re-sends publish notifications to selected audience groups for an
 * already-published project. This allows the admin to notify additional
 * groups after the initial publish without un-publishing and re-publishing.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params
    const body = await req.json()

    const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, title: true, slug: true, status: true, published: true, sponsorData: true, projectType: true, translations: true },
    })

    if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    if (!project.published) {
        return NextResponse.json({ error: 'Project is not published. Publish it first.' }, { status: 400 })
    }

    // Read audience selection — default to nobody
    const notifyGroups: { subscribers?: boolean; members?: boolean; cast?: boolean } = body.notifyGroups ?? {
        subscribers: false, members: false, cast: false,
    }

    // At least one group must be selected
    if (!notifyGroups.subscribers && !notifyGroups.members && !notifyGroups.cast) {
        return NextResponse.json({ error: 'Select at least one audience group.' }, { status: 400 })
    }

    // Build the link
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
    const pagePath = project.status === 'completed' ? `/en/works/${project.slug}/watch` : `/en/works/${project.slug}`
    const link = `${siteUrl}${pagePath}`

    let sponsorParsed: { name: string; logoUrl?: string; description?: string } | null = null
    try {
        if (project.sponsorData) {
            sponsorParsed = typeof project.sponsorData === 'string'
                ? JSON.parse(project.sponsorData)
                : project.sponsorData
        }
    } catch { /* ignore */ }

    // Fire notifications (async — returns immediately)
    notifyContentPublish(
        project.title,
        project.projectType || 'project',
        link,
        project.status,
        sponsorParsed,
        notifyGroups,
        project.id,
        project.translations,
    ).catch(err => {
        console.error('[resend] notifyContentPublish failed:', err)
    })

    // Audit log
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        await db.auditLog.create({
            data: {
                adminId: 'system',
                adminEmail: 'admin',
                action: 'resend_notification',
                targetType: 'project',
                targetId: project.id,
                targetEmail: JSON.stringify(notifyGroups),
            },
        })
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, message: 'Notifications queued for selected audience.' })
}
