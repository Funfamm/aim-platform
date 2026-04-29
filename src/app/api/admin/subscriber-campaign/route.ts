import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { generateUnsubscribeToken } from '@/lib/unsubscribe-token'

function isAdmin(role: string) {
    return role === 'admin' || role === 'superadmin'
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://impactaistudio.com'

/**
 * POST /api/admin/subscriber-campaign
 * 
 * Sends a conversion email to subscribers who haven't created an account.
 * Body: { dryRun?: boolean }
 */
export async function POST(req: Request) {
    const session = await getUserSession()
    if (!session?.userId || !isAdmin(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json().catch(() => ({}))
        const dryRun = body.dryRun === true
        const testEmail = body.testEmail as string | undefined

        // ── Test mode: send one email to the admin ──
        if (testEmail) {
            const latestFilm = await prisma.project.findFirst({
                where: { published: true },
                orderBy: { publishAt: 'desc' },
                select: { title: true },
            })
            const filmTitle = latestFilm?.title || 'our latest film'
            const token = generateUnsubscribeToken(testEmail, 'subscriber')
            const registerUrl = `${SITE_URL}/register?token=${encodeURIComponent(token)}&utm_source=conversion_campaign`
            const html = buildConversionEmail('Test User', filmTitle, registerUrl)

            await prisma.emailQueue.create({
                data: {
                    to: testEmail,
                    subject: `[TEST] 🎬 Watch "${filmTitle}" free — your account is waiting`,
                    html,
                    type: 'conversion_campaign',
                    priority: 1,
                    status: 'pending',
                },
            })

            return NextResponse.json({
                message: `Test email queued to ${testEmail}`,
                filmTitle,
            })
        }

        // Get all active subscribers
        const subscribers = await prisma.subscriber.findMany({
            where: { active: true, suppressedAt: null },
            select: { id: true, email: true, name: true },
        })

        // Get all user emails (case-insensitive comparison done in JS)
        const users = await prisma.user.findMany({
            select: { email: true },
        })
        const registeredEmails = new Set(users.map(u => u.email.toLowerCase()))

        // Filter to subscribers who haven't registered
        const eligible = subscribers.filter(s => !registeredEmails.has(s.email.toLowerCase()))

        if (dryRun) {
            return NextResponse.json({
                eligible: eligible.length,
                total: subscribers.length,
                alreadyRegistered: subscribers.length - eligible.length,
                sampleEmails: eligible.slice(0, 5).map(s => s.email),
            })
        }

        // Check duplicate send protection
        const settings = await (prisma as any).siteSettings.findUnique({
            where: { id: 'default' },
            select: { id: true },
        }).catch(() => null)

        // Use a simple file-based check via a campaign log in the DB
        // We'll store campaign metadata as a JSON string in a temporary approach
        // using the EmailLog to check recent campaign sends
        const recentCampaign = await prisma.emailLog.findFirst({
            where: {
                type: 'conversion_campaign',
                sentAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                success: true,
            },
            orderBy: { sentAt: 'desc' },
        })

        if (recentCampaign) {
            return NextResponse.json({
                error: 'Campaign was sent recently',
                lastSentAt: recentCampaign.sentAt,
            }, { status: 409 })
        }

        // Get latest published film title
        const latestFilm = await prisma.project.findFirst({
            where: { published: true },
            orderBy: { publishAt: 'desc' },
            select: { title: true },
        })
        const filmTitle = latestFilm?.title || 'our latest film'

        // Queue emails in batches of 50
        const campaignId = `conv-${Date.now()}`
        let queued = 0
        const batchSize = 50

        for (let i = 0; i < eligible.length; i += batchSize) {
            const batch = eligible.slice(i, i + batchSize)
            const emailRecords = batch.map(sub => {
                const token = generateUnsubscribeToken(sub.email, 'subscriber')
                const registerUrl = `${SITE_URL}/register?token=${encodeURIComponent(token)}&utm_source=conversion_campaign`

                const name = sub.name || 'there'
                const subject = `🎬 Watch "${filmTitle}" free — your account is waiting`
                const html = buildConversionEmail(name, filmTitle, registerUrl)

                return {
                    to: sub.email,
                    subject,
                    html,
                    type: 'conversion_campaign' as const,
                    priority: 3,
                    status: 'pending' as const,
                    campaignId,
                }
            })

            await prisma.emailQueue.createMany({ data: emailRecords })
            queued += batch.length
        }

        // Log the campaign send
        await prisma.emailLog.create({
            data: {
                to: 'campaign@system',
                subject: `Conversion campaign: ${queued} emails`,
                type: 'conversion_campaign',
                success: true,
                transport: 'queue',
            },
        })

        return NextResponse.json({
            queued,
            skipped: subscribers.length - eligible.length,
            filmTitle,
            campaignId,
            message: `Campaign queued for ${queued} subscribers`,
        })
    } catch (err) {
        console.error('[subscriber-campaign] Error:', err)
        return NextResponse.json({ error: 'Campaign failed' }, { status: 500 })
    }
}

// ── GET: Campaign status for admin UI ──
export async function GET(req: Request) {
    const session = await getUserSession()
    if (!session?.userId || !isAdmin(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Count eligible subscribers
    const subscribers = await prisma.subscriber.findMany({
        where: { active: true, suppressedAt: null },
        select: { email: true },
    })
    const users = await prisma.user.findMany({ select: { email: true } })
    const registeredEmails = new Set(users.map(u => u.email.toLowerCase()))
    const eligible = subscribers.filter(s => !registeredEmails.has(s.email.toLowerCase()))

    // Last campaign info
    const lastCampaign = await prisma.emailLog.findFirst({
        where: { type: 'conversion_campaign', success: true },
        orderBy: { sentAt: 'desc' },
    })

    const cooldownActive = lastCampaign
        ? (Date.now() - lastCampaign.sentAt.getTime()) < 7 * 24 * 60 * 60 * 1000
        : false

    return NextResponse.json({
        eligible: eligible.length,
        total: subscribers.length,
        alreadyRegistered: subscribers.length - eligible.length,
        lastSentAt: lastCampaign?.sentAt || null,
        cooldownActive,
    })
}

/** Build the conversion email HTML */
function buildConversionEmail(name: string, filmTitle: string, registerUrl: string): string {
    const BG = '#0d0f14'
    const CARD = '#15171e'
    const GOLD = '#d4a853'
    const TEXT = '#e8e6e1'
    const MUTED = '#9ca3af'

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Your Account is Waiting</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};"><tr><td align="center" style="padding:40px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
<!-- Header -->
<tr><td style="text-align:center;padding:24px 0;">
<span style="font-size:24px;font-weight:800;color:${TEXT};">🎬 AIM Studio</span>
</td></tr>
<!-- Body Card -->
<tr><td style="background:${CARD};border-radius:16px;padding:40px 32px;border:1px solid rgba(255,255,255,0.06);">
<p style="font-size:16px;color:${TEXT};margin:0 0 16px;">Hi ${name},</p>
<p style="font-size:15px;color:${MUTED};line-height:1.7;margin:0 0 24px;">You've been part of the AIM Studio community for a while now. We realized we never told you about the best part.</p>
<!-- Benefits -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px;padding:16px 20px;background:rgba(212,168,83,0.06);border-radius:12px;border-left:3px solid ${GOLD};">
<tr><td style="padding:6px 0;font-size:14px;color:${TEXT};">🎬 Watch full films for free</td></tr>
<tr><td style="padding:6px 0;font-size:14px;color:${TEXT};">🎭 Apply for casting opportunities</td></tr>
<tr><td style="padding:6px 0;font-size:14px;color:${TEXT};">💬 Join the conversation</td></tr>
</table>
<!-- CTA -->
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="${registerUrl}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,${GOLD},#c49a3c);color:#000;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;">Create Your Free Account →</a>
</td></tr></table>
<p style="font-size:13px;color:${MUTED};text-align:center;margin:20px 0 0;">It takes 30 seconds. No payment required.</p>
</td></tr>
<!-- Footer -->
<tr><td style="padding:24px 0;text-align:center;">
<p style="font-size:12px;color:${MUTED};margin:0;line-height:1.6;">You're receiving this because you subscribed to AIM Studio updates.<br/>You can unsubscribe at any time.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`
}
