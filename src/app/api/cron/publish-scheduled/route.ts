/**
 * GET /api/cron/publish-scheduled
 *
 * Vercel Cron Job endpoint — runs every 5 minutes (see vercel.json).
 *
 * Pass 1 — Projects:
 *   Finds all projects where published = false AND publishAt <= now()
 *   Sets published = true, fires notification pipeline.
 *
 * Pass 2 — Scheduled Outreach:
 *   Finds all Announcement rows where status = 'scheduled' AND scheduledAt <= now()
 *   Fires notifyAnnouncement() then sets status = 'sent'.
 *
 * Security: protected by CRON_SECRET header set in Vercel dashboard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { notifyContentPublish, notifyAnnouncement } from '@/lib/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    // Vercel sends Authorization: Bearer <CRON_SECRET>
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    logger.info('cron/publish-scheduled', `Running at ${now.toISOString()}`)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    // ── Pass 1: Projects ──────────────────────────────────────────────────────
    let published = 0
    let failedProjects = 0

    try {
        const dueProjets = await db.project.findMany({
            where: {
                published: false,
                publishAt: { lte: now },
            },
            select: {
                id: true, title: true, slug: true, status: true,
                sponsorData: true, translations: true,
                publishNotifyGroups: true,
            },
        })

        if (dueProjets.length > 0) {
            logger.info('cron/publish-scheduled', `Found ${dueProjets.length} project(s) to publish`)

            const results = await Promise.allSettled(
                dueProjets.map(async (project: { id: string; title: string; slug: string; status: string; sponsorData: string | null; translations: string | null; publishNotifyGroups: string | null }) => {
                    try {
                        await db.project.update({
                            where: { id: project.id },
                            data: { published: true, publishAt: null, publishNotifyGroups: null },
                        })

                        let sponsorData = null
                        if (project.sponsorData) {
                            try { sponsorData = JSON.parse(project.sponsorData) } catch { /* ignore */ }
                        }

                        let groups: { subscribers?: boolean; members?: boolean; cast?: boolean } = {
                            subscribers: false, members: false, cast: false,
                        }
                        if (project.publishNotifyGroups) {
                            try { groups = JSON.parse(project.publishNotifyGroups) } catch { /* ignore */ }
                        }

                        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
                        await notifyContentPublish(
                            project.title,
                            'project',
                            `${siteUrl}/en/works/${project.slug}`,
                            project.status,
                            sponsorData,
                            groups,
                            project.id,
                            project.translations,
                        )

                        logger.info('cron/publish-scheduled', `Published: ${project.title} (${project.id})`)
                        return { id: project.id, ok: true }
                    } catch (err) {
                        logger.error('cron/publish-scheduled', `Failed to publish ${project.id}: ${project.title}`, { error: err })
                        return { id: project.id, ok: false, error: String(err) }
                    }
                })
            )

            published = results.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ ok: boolean }>).value.ok).length
            failedProjects = dueProjets.length - published
        }
    } catch (err) {
        logger.error('cron/publish-scheduled', 'Project publish pass failed', { error: err })
    }

    // ── Pass 2: Scheduled Outreach ─────────────────────────────────────────────
    let announcementsFired = 0
    let announcementsFailed = 0

    try {
        const dueAnnouncements = await db.announcement.findMany({
            where: {
                status: 'scheduled',
                scheduledAt: { lte: now },
            },
        })

        if (dueAnnouncements.length > 0) {
            logger.info('cron/publish-scheduled', `Found ${dueAnnouncements.length} scheduled outreach(es) to fire`)

            await Promise.allSettled(
                dueAnnouncements.map(async (ann: {
                    id: string; title: string; message: string; link: string | null
                    translations: string | null; imageUrl: string | null; bodyHtml: string | null
                    audienceGroups: string | null; specificUserIds: string | null
                    ctaText: string | null; ctaUrl: string | null; ctaColor: string | null
                }) => {
                    try {
                        // Parse stored JSON fields
                        let translations: Record<string, Record<string, string>> | null = null
                        if (ann.translations) {
                            try { translations = JSON.parse(ann.translations) } catch { /* ignore */ }
                        }
                        let groups: { subscribers?: boolean; members?: boolean; cast?: boolean } = {}
                        if (ann.audienceGroups) {
                            try { groups = JSON.parse(ann.audienceGroups) } catch { /* ignore */ }
                        }
                        let specificUserIds: string[] | undefined
                        if (ann.specificUserIds) {
                            try { specificUserIds = JSON.parse(ann.specificUserIds) } catch { /* ignore */ }
                        }
                        const ctaOverride = (ann.ctaText && ann.ctaUrl)
                            ? { text: ann.ctaText, url: ann.ctaUrl, color: ann.ctaColor || '#c9a84c' }
                            : undefined

                        // Fire delivery
                        await notifyAnnouncement(
                            ann.title, ann.message, ann.link ?? undefined,
                            translations, ann.imageUrl ?? undefined, ann.bodyHtml ?? undefined,
                            groups, specificUserIds, ctaOverride,
                        )

                        // Mark as sent and record actual send time
                        await db.announcement.update({
                            where: { id: ann.id },
                            data: { status: 'sent', sentAt: new Date() },
                        })

                        logger.info('cron/publish-scheduled', `Outreach fired: "${ann.title}" (${ann.id})`)
                        announcementsFired++
                    } catch (err) {
                        logger.error('cron/publish-scheduled', `Failed to fire outreach ${ann.id}`, { error: err })
                        await db.announcement.update({
                            where: { id: ann.id },
                            data: { status: 'failed' },
                        }).catch(() => { /* non-critical */ })
                        announcementsFailed++
                    }
                })
            )
        }
    } catch (err) {
        logger.error('cron/publish-scheduled', 'Outreach scheduled pass failed', { error: err })
    }

    return NextResponse.json({
        projects: { published, failed: failedProjects },
        outreach: { fired: announcementsFired, failed: announcementsFailed },
    })
}
