const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
    console.log('═══════════════════════════════════════════════════')
    console.log('  📊 SURVEY CAMPAIGN — FULL STATUS REPORT')
    console.log('═══════════════════════════════════════════════════\n')

    // ── 1. Email Queue Status ──
    const queueStatus = await p.$queryRawUnsafe(
        `SELECT status, COUNT(*)::int as count FROM "EmailQueue" WHERE type = 'survey_campaign' GROUP BY status ORDER BY count DESC`
    )
    const queueMap = {}
    let queueTotal = 0
    for (const row of queueStatus) {
        queueMap[row.status] = row.count
        queueTotal += row.count
    }
    console.log('📬 EMAIL QUEUE (survey_campaign)')
    console.log(`   Total queued:  ${queueTotal}`)
    console.log(`   ✅ Sent:        ${queueMap.sent || 0}`)
    console.log(`   ⏳ Pending:     ${queueMap.pending || 0}`)
    console.log(`   🔄 Processing:  ${queueMap.processing || 0}`)
    console.log(`   ❌ Failed:      ${queueMap.failed || 0}`)
    console.log(`   🚫 Cancelled:   ${queueMap.cancelled || 0}`)

    // ── 2. EmailLog Stats ──
    const logTotal = await p.emailLog.count({ where: { type: 'survey_campaign' } })
    const logSuccess = await p.emailLog.count({ where: { type: 'survey_campaign', success: true } })
    const logFailed = await p.emailLog.count({ where: { type: 'survey_campaign', success: false } })
    console.log('\n📋 EMAIL LOG (delivery confirmations)')
    console.log(`   Total logged:  ${logTotal}`)
    console.log(`   ✅ Success:     ${logSuccess}`)
    console.log(`   ❌ Failed:      ${logFailed}`)

    // ── 3. Transport breakdown ──
    const transports = await p.$queryRawUnsafe(
        `SELECT transport, COUNT(*)::int as count FROM "EmailLog" WHERE type = 'survey_campaign' GROUP BY transport`
    )
    console.log('\n🚛 TRANSPORT BREAKDOWN')
    for (const t of transports) {
        console.log(`   ${t.transport || 'unknown'}: ${t.count}`)
    }

    // ── 4. Failed emails detail ──
    const failures = await p.emailLog.findMany({
        where: { type: 'survey_campaign', success: false },
        select: { to: true, error: true, sentAt: true },
        take: 20,
    })
    if (failures.length > 0) {
        console.log('\n🔴 FAILED DELIVERIES')
        for (const f of failures) {
            console.log(`   ${f.to} — ${(f.error || 'unknown').slice(0, 100)}`)
        }
    }

    // ── 5. Stuck in processing ──
    const stuck = await p.emailQueue.count({
        where: { type: 'survey_campaign', status: 'processing', updatedAt: { lt: new Date(Date.now() - 5 * 60 * 1000) } }
    })
    if (stuck > 0) {
        console.log(`\n⚠️  ${stuck} emails stuck in 'processing' for >5 minutes`)
    }

    // ── 6. Subscriber stats ──
    const totalSubs = await p.subscriber.count()
    const activeSubs = await p.subscriber.count({ where: { active: true } })
    const suppressedSubs = await p.subscriber.count({ where: { suppressedAt: { not: null } } })
    const nonSuppressed = await p.subscriber.count({ where: { active: true, suppressedAt: null } })
    console.log('\n👥 SUBSCRIBERS')
    console.log(`   Total:          ${totalSubs}`)
    console.log(`   Active:         ${activeSubs}`)
    console.log(`   Suppressed:     ${suppressedSubs}`)
    console.log(`   Eligible:       ${nonSuppressed}`)

    // ── 7. Survey responses ──
    const survey = await p.survey.findFirst({ where: { active: true }, orderBy: { createdAt: 'desc' } })
    if (survey) {
        const responses = await p.surveyResponse.count({ where: { surveyId: survey.id } })
        const converted = await p.surveyResponse.count({ where: { surveyId: survey.id, converted: true } })
        const flagged = await p.surveyResponse.count({ where: { surveyId: survey.id, flagged: true } })
        console.log('\n📝 SURVEY RESPONSES')
        console.log(`   Total:      ${responses}`)
        console.log(`   Converted:  ${converted}`)
        console.log(`   Flagged:    ${flagged}`)
    }

    // ── 8. Last 15 successful deliveries ──
    const recent = await p.emailLog.findMany({
        where: { type: 'survey_campaign', success: true },
        orderBy: { sentAt: 'desc' },
        take: 15,
        select: { to: true, sentAt: true, transport: true },
    })
    console.log('\n📨 LAST 15 SUCCESSFUL DELIVERIES')
    for (const r of recent) {
        console.log(`   ${r.sentAt?.toISOString().replace('T', ' ').slice(0, 19)} | ${r.to} | ${r.transport}`)
    }

    // ── 9. Delivery rate ──
    const firstSent = await p.emailLog.findFirst({
        where: { type: 'survey_campaign', success: true },
        orderBy: { sentAt: 'asc' },
        select: { sentAt: true },
    })
    const lastSent = await p.emailLog.findFirst({
        where: { type: 'survey_campaign', success: true },
        orderBy: { sentAt: 'desc' },
        select: { sentAt: true },
    })
    if (firstSent?.sentAt && lastSent?.sentAt && logSuccess > 1) {
        const elapsedMin = (lastSent.sentAt.getTime() - firstSent.sentAt.getTime()) / 60000
        const rate = elapsedMin > 0 ? Math.round(logSuccess / elapsedMin) : logSuccess
        console.log(`\n⚡ DELIVERY RATE: ~${rate} emails/min over ${Math.round(elapsedMin)} minutes`)
        const remaining = (queueMap.pending || 0) + (queueMap.processing || 0)
        if (remaining > 0 && rate > 0) {
            console.log(`   ETA for remaining ${remaining}: ~${Math.ceil(remaining / rate)} minutes`)
        }
    }

    console.log('\n═══════════════════════════════════════════════════')

    await p.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
