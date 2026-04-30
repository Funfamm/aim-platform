import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { generateUnsubscribeToken } from '@/lib/unsubscribe-token'
import { surveyInviteEmail } from '@/lib/email-templates'
import { inferLocaleFromCountry } from '@/lib/locale-utils'

function isAdmin(role: string) {
    return role === 'admin' || role === 'superadmin'
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://impactaistudio.com'

export async function POST(req: Request) {
    const session = await getUserSession()
    if (!session?.userId || !isAdmin(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json().catch(() => ({}))
        const testEmail = body.testEmail as string | undefined

        // ── Test mode: send one email ──
        if (testEmail) {
            // Get or create survey
            let survey = await prisma.survey.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
            if (!survey) {
                survey = await prisma.survey.create({ data: { title: 'Audience Survey 2026' } })
            }

            const token = generateUnsubscribeToken(testEmail, 'subscriber')
            const surveyUrl = `${SITE_URL}/survey?token=${encodeURIComponent(token)}&sid=${survey.id}&utm_source=survey_email`
            const html = surveyInviteEmail('Test User', surveyUrl, 'en')

            await prisma.emailQueue.create({
                data: {
                    to: testEmail,
                    subject: `[TEST] You shape what AIM Studio makes next 🎬`,
                    html,
                    type: 'survey_campaign',
                    priority: 1,
                    status: 'pending',
                },
            })

            return NextResponse.json({ message: `Test email queued to ${testEmail}`, surveyId: survey.id })
        }

        // ── Duplicate send check — 30-day window ──
        const recentCampaign = await prisma.emailLog.findFirst({
            where: {
                type: 'survey_campaign',
                sentAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                success: true,
            },
            orderBy: { sentAt: 'desc' },
        })

        if (recentCampaign) {
            return NextResponse.json({
                error: 'Survey campaign was sent recently',
                lastSentAt: recentCampaign.sentAt,
            }, { status: 409 })
        }

        // ── Get or create active survey ──
        let survey = await prisma.survey.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
        if (!survey) {
            survey = await prisma.survey.create({ data: { title: 'Audience Survey 2026' } })
        }

        // ── Query all active, non-suppressed subscribers ──
        const subscribers = await prisma.subscriber.findMany({
            where: { active: true, suppressedAt: null },
            select: { id: true, email: true, name: true, locale: true, country: true },
        })

        // ── Queue emails in batches of 50 ──
        const campaignId = `survey-${Date.now()}`
        let queued = 0
        const batchSize = 50

        for (let i = 0; i < subscribers.length; i += batchSize) {
            const batch = subscribers.slice(i, i + batchSize)
            const emailRecords = batch.map(sub => {
                const token = generateUnsubscribeToken(sub.email, 'subscriber')
                const surveyUrl = `${SITE_URL}/survey?token=${encodeURIComponent(token)}&sid=${survey!.id}&utm_source=survey_email`
                const locale = inferLocaleFromCountry(sub.country, sub.locale)
                const name = sub.name || null
                const html = surveyInviteEmail(name, surveyUrl, locale)

                return {
                    to: sub.email,
                    subject: 'You shape what AIM Studio makes next 🎬',
                    html,
                    type: 'survey_campaign' as const,
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
                subject: `Survey campaign: ${queued} emails`,
                type: 'survey_campaign',
                success: true,
                transport: 'queue',
            },
        })

        return NextResponse.json({
            queued,
            total: subscribers.length,
            surveyId: survey.id,
            campaignId,
        })
    } catch (error) {
        console.error('[Admin Survey Send] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
