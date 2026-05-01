import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendTransactionalEmail } from '@/lib/email-router'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: Request) {
  // Auth via cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) {
    return NextResponse.json({ error: 'ADMIN_EMAIL not configured' }, { status: 500 })
  }

  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Gather all metrics in parallel - each wrapped in try/catch to avoid one failure breaking the whole summary
  const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn() } catch { return fallback }
  }

  const [
    totalUsers,
    newUsers24h,
    totalSubscribers,
    newSubscribers24h,
    totalProjects,
    publishedProjects,
    pageViews24h,
    pageViews7d,
    filmViews24h,
    newComments24h,
    pendingApplications,
    flaggedComments,
    failedEmails24h,
    stuckEmails,
    surveyResponses24h,
    contactMessages24h,
  ] = await Promise.all([
    safe(() => prisma.user.count(), 0),
    safe(() => prisma.user.count({ where: { createdAt: { gte: yesterday } } }), 0),
    safe(() => prisma.subscriber.count({ where: { active: true } }), 0),
    safe(() => prisma.subscriber.count({ where: { subscribedAt: { gte: yesterday }, active: true } }), 0),
    safe(() => prisma.project.count(), 0),
    safe(() => prisma.project.count({ where: { published: true } }), 0),
    safe(() => prisma.pageView.count({ where: { createdAt: { gte: yesterday } } }), 0),
    safe(() => prisma.pageView.count({ where: { createdAt: { gte: sevenDaysAgo } } }), 0),
    safe(() => prisma.filmView.count({ where: { createdAt: { gte: yesterday } } }), 0),
    safe(() => prisma.comment.count({ where: { createdAt: { gte: yesterday } } }), 0),
    safe(() => prisma.application.count({ where: { status: 'submitted' } }), 0),
    safe(() => prisma.comment.count({ where: { flagged: true, hidden: false } }), 0),
    safe(() => prisma.emailLog.count({ where: { success: false, sentAt: { gte: yesterday } } }), 0),
    safe(() => prisma.emailQueue.count({
      where: {
        status: 'processing',
        claimedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
      },
    }), 0),
    safe(() => prisma.surveyResponse.count({ where: { createdAt: { gte: yesterday } } }), 0),
    safe(() => prisma.contactMessage.count({ where: { createdAt: { gte: yesterday } } }), 0),
  ])

  // Build the email HTML
  const html = buildDailySummaryHtml({
    date: now,
    totalUsers, newUsers24h,
    totalSubscribers, newSubscribers24h,
    totalProjects, publishedProjects,
    pageViews24h, pageViews7d,
    filmViews24h,
    newComments24h, flaggedComments,
    pendingApplications,
    failedEmails24h, stuckEmails,
    surveyResponses24h,
    contactMessages24h,
  })

  await sendTransactionalEmail({
    to: adminEmail,
    subject: `AIM Studio Daily Summary - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    html,
    type: 'admin_summary',
  })

  return NextResponse.json({ sent: true, recipient: adminEmail })
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDailySummaryHtml(d: any): string {
  const fmt = (n: number) => n.toLocaleString('en-US')
  const trend = (n: number) => n > 0 ? `+${n}` : `${n}`
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'

  const dateStr = d.date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })

  const attentionRows: string[] = []
  if (d.pendingApplications > 0)
    attentionRows.push(row('Pending casting applications', d.pendingApplications, '#fbbf24'))
  if (d.flaggedComments > 0)
    attentionRows.push(row('Flagged comments', d.flaggedComments, '#fbbf24'))
  if (d.contactMessages24h > 0)
    attentionRows.push(row('New contact messages (24h)', d.contactMessages24h, '#fbbf24'))
  if (d.surveyResponses24h > 0)
    attentionRows.push(row('Survey responses (24h)', d.surveyResponses24h, '#fbbf24'))

  const issueRows: string[] = []
  if (d.failedEmails24h > 0)
    issueRows.push(row('Failed emails (24h)', d.failedEmails24h, '#ef4444'))
  if (d.stuckEmails > 0)
    issueRows.push(row('Stuck email jobs (>10 min)', d.stuckEmails, '#ef4444'))

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#fff;padding:24px;max-width:600px;margin:0 auto;">

  <div style="text-align:center;margin-bottom:32px;">
    <h1 style="color:#c9a84c;font-size:24px;margin:0;">AIM Studio</h1>
    <p style="color:rgba(255,255,255,0.5);margin:4px 0 0;font-size:13px;">Daily Summary - ${dateStr}</p>
  </div>

  ${section('Audience', [
    row('Total users', fmt(d.totalUsers)),
    row('New users (24h)', trend(d.newUsers24h), d.newUsers24h > 0 ? '#4ade80' : undefined),
    row('Active subscribers', fmt(d.totalSubscribers)),
    row('New subscribers (24h)', trend(d.newSubscribers24h), d.newSubscribers24h > 0 ? '#4ade80' : undefined),
  ])}

  ${section('Content', [
    row('Published projects', `${d.publishedProjects} / ${d.totalProjects}`),
    row('Page views (24h)', fmt(d.pageViews24h)),
    row('Page views (7d)', fmt(d.pageViews7d)),
    row('Films watched (24h)', fmt(d.filmViews24h)),
    row('New comments (24h)', fmt(d.newComments24h)),
  ])}

  ${attentionRows.length > 0 ? section('Needs Your Attention', attentionRows) : ''}

  ${issueRows.length > 0 ? `
  <h2 style="color:#ef4444;font-size:16px;border-bottom:1px solid rgba(239,68,68,0.3);padding-bottom:8px;margin-top:24px;">Issues</h2>
  <table style="width:100%;margin:12px 0;border-collapse:collapse;">${issueRows.join('')}</table>` : ''}

  <div style="margin-top:32px;padding:16px;background:rgba(255,255,255,0.03);border-radius:8px;text-align:center;">
    <a href="${siteUrl}/admin" style="color:#c9a84c;text-decoration:none;font-weight:600;">Open Admin Dashboard</a>
  </div>

  <p style="color:rgba(255,255,255,0.3);font-size:11px;text-align:center;margin-top:24px;">
    Daily admin summary from AIM Studio. To disable, remove the ADMIN_EMAIL environment variable.
  </p>

</body>
</html>`
}

function section(title: string, rows: string[]): string {
  return `
  <h2 style="color:#c9a84c;font-size:16px;border-bottom:1px solid rgba(201,168,76,0.3);padding-bottom:8px;margin-top:24px;">${title}</h2>
  <table style="width:100%;margin:12px 0;border-collapse:collapse;">${rows.join('')}</table>`
}

function row(label: string, value: string | number, color?: string): string {
  const valStyle = color
    ? `text-align:right;font-weight:600;color:${color};`
    : 'text-align:right;font-weight:600;'
  return `<tr>
    <td style="padding:8px 0;color:rgba(255,255,255,0.7);">${label}</td>
    <td style="padding:8px 0;${valStyle}">${value}</td>
  </tr>`
}
