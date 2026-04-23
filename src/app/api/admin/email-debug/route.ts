import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

/**
 * GET /api/admin/email-debug
 * Returns a diagnostic report showing exactly why emails may not be sending.
 * Admin-only.
 */
export async function GET() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    const settings = await db.siteSettings.findFirst({
        select: {
            emailsEnabled: true,
            emailTransport: true,
            smtpHost: true,
            smtpPort: true,
            smtpUser: true,
            smtpFromEmail: true,
            smtpFromName: true,
            notifyOnContentPublish: true,
            notifyOnNewRole: true,
            notifyOnAnnouncement: true,
        }
    })

    const issues: string[] = []
    const ok: string[] = []

    if (!settings) {
        issues.push('❌ No SiteSettings record found in DB')
    } else {
        if (!settings.emailsEnabled) issues.push('❌ emailsEnabled is FALSE — all emails disabled')
        else ok.push('✅ emailsEnabled = true')

        if (!settings.notifyOnContentPublish) issues.push('❌ notifyOnContentPublish is FALSE — publish emails blocked')
        else ok.push('✅ notifyOnContentPublish = true')

        if (settings.emailTransport === 'graph') {
            const hasAzure = !!(process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET)
            if (!hasAzure) {
                issues.push('❌ Transport is "graph" but AZURE_TENANT_ID / AZURE_CLIENT_ID / AZURE_CLIENT_SECRET are MISSING from environment — emails will silently fail')
                issues.push('💡 Fix: Go to Settings → Email → switch transport to "SMTP", or add Azure env vars to Vercel')
            } else {
                ok.push('✅ Graph transport + Azure credentials present')
            }
        } else if (settings.emailTransport === 'smtp') {
            if (!settings.smtpHost) issues.push('❌ SMTP selected but smtpHost is empty')
            else ok.push(`✅ SMTP host: ${settings.smtpHost}`)
            if (!settings.smtpUser) issues.push('❌ SMTP selected but smtpUser is empty')
            else ok.push(`✅ SMTP user: ${settings.smtpUser}`)
        }
    }

    // User and subscriber counts
    const userCount = await db.user.count()
    const subscriberCount = await db.subscriber.count({ where: { active: true } })

    // Recent email log entries
    const recentLogs = await db.emailLog.findMany({
        orderBy: { sentAt: 'desc' },
        take: 10,
        select: { to: true, subject: true, success: true, error: true, transport: true, sentAt: true }
    }).catch(() => [])

    return NextResponse.json({
        status: issues.length === 0 ? 'ok' : 'issues_found',
        issues,
        ok,
        db_settings: settings,
        env: {
            AZURE_TENANT_ID: !!process.env.AZURE_TENANT_ID,
            AZURE_CLIENT_ID: !!process.env.AZURE_CLIENT_ID,
            AZURE_CLIENT_SECRET: !!process.env.AZURE_CLIENT_SECRET,
            GRAPH_EMAIL_SENDER: process.env.GRAPH_EMAIL_SENDER || null,
            NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || null,
        },
        audience: { users: userCount, activeSubscribers: subscriberCount },
        recent_email_logs: recentLogs,
    })
}
