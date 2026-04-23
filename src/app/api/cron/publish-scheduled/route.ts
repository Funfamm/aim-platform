/**
 * GET /api/cron/publish-scheduled
 *
 * Vercel Cron Job endpoint — runs every 5 minutes (see vercel.json).
 * Finds all projects where:
 *   - published = false
 *   - publishAt <= now()
 *
 * For each matching project:
 *   1. Sets published = true, clears publishAt
 *   2. Runs the same notification/publish flow used for manual publish
 *   3. Logs the action
 *
 * Fails safely: if a project is invalid or a notification fails, it is
 * skipped and the error is logged without crashing the rest of the run.
 *
 * Security: protected by CRON_SECRET header set in Vercel dashboard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { notifyContentPublish } from '@/lib/notifications'

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

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any

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

        if (dueProjets.length === 0) {
            logger.info('cron/publish-scheduled', 'No projects due for publishing')
            return NextResponse.json({ published: 0 })
        }

        logger.info('cron/publish-scheduled', `Found ${dueProjets.length} project(s) to publish`)

        const results = await Promise.allSettled(
            dueProjets.map(async (project: { id: string; title: string; slug: string; status: string; sponsorData: string | null; translations: string | null; publishNotifyGroups: string | null }) => {
                try {
                    // 1. Mark as published + clear the scheduled time + clear saved audience
                    await db.project.update({
                        where: { id: project.id },
                        data: { published: true, publishAt: null, publishNotifyGroups: null },
                    })

                    // 2. Parse sponsor data if present
                    let sponsorData = null
                    if (project.sponsorData) {
                        try { sponsorData = JSON.parse(project.sponsorData) } catch { /* ignore */ }
                    }

                    // 3. Parse audience selection — defaults to nobody if not set
                    let groups: { subscribers?: boolean; members?: boolean; cast?: boolean } = {
                        subscribers: false, members: false, cast: false,
                    }
                    if (project.publishNotifyGroups) {
                        try { groups = JSON.parse(project.publishNotifyGroups) } catch { /* ignore */ }
                    }

                    // 4. Fire the notification pipeline with saved audience selection
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

        const published = results.filter(r => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ ok: boolean }>).value.ok).length
        const failed = dueProjets.length - published

        return NextResponse.json({ published, failed, total: dueProjets.length })
    } catch (err) {
        logger.error('cron/publish-scheduled', 'Cron job failed', { error: err })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
