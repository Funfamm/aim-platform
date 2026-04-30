const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
    // Queue status for survey_campaign
    const queueStatus = await p.$queryRawUnsafe(
        `SELECT status, COUNT(*)::int as count FROM "EmailQueue" WHERE type = 'survey_campaign' GROUP BY status ORDER BY count DESC`
    )
    console.log('EmailQueue (survey_campaign) by status:', JSON.stringify(queueStatus))

    // EmailLog entries for survey_campaign
    const logCount = await p.emailLog.count({ where: { type: 'survey_campaign' } })
    const successCount = await p.emailLog.count({ where: { type: 'survey_campaign', success: true } })
    const failCount = await p.emailLog.count({ where: { type: 'survey_campaign', success: false } })
    console.log(`\nEmailLog (survey_campaign): ${logCount} total, ${successCount} success, ${failCount} failed`)

    // Show last 10 sent
    const recent = await p.emailLog.findMany({
        where: { type: 'survey_campaign' },
        orderBy: { sentAt: 'desc' },
        take: 10,
        select: { to: true, success: true, transport: true, sentAt: true, error: true },
    })
    console.log('\nLast 10 entries:')
    for (const r of recent) {
        console.log(`  ${r.sentAt?.toISOString()} | ${r.to} | ${r.success ? '✅' : '❌'} | ${r.transport} ${r.error ? '| ' + r.error.slice(0, 80) : ''}`)
    }

    // Pending in queue
    const pending = await p.emailQueue.count({ where: { type: 'survey_campaign', status: 'pending' } })
    const processing = await p.emailQueue.count({ where: { type: 'survey_campaign', status: 'processing' } })
    console.log(`\nQueue: ${pending} pending, ${processing} processing`)

    await p.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
