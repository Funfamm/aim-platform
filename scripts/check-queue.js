const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
    // Check failed job errors
    const failedErrors = await p.$queryRawUnsafe(`
        SELECT error, COUNT(*)::int as count
        FROM "EmailQueue"
        WHERE type = 'survey_campaign' AND status = 'failed'
        GROUP BY error
        ORDER BY count DESC
        LIMIT 10
    `)
    console.log('Failed job reasons:')
    for (const row of failedErrors) {
        console.log(`  [${row.count}] ${(row.error || 'NULL').slice(0, 120)}`)
    }

    // Check attempts distribution
    const attempts = await p.$queryRawUnsafe(`
        SELECT attempts, status, COUNT(*)::int as count
        FROM "EmailQueue"
        WHERE type = 'survey_campaign'
        GROUP BY attempts, status
        ORDER BY attempts, status
    `)
    console.log('\nAttempts distribution:')
    for (const row of attempts) {
        console.log(`  attempts=${row.attempts} status=${row.status}: ${row.count}`)
    }

    // Sample a few failed jobs
    const sample = await p.emailQueue.findMany({
        where: { type: 'survey_campaign', status: 'failed' },
        take: 5,
        select: { to: true, attempts: true, error: true, claimedAt: true, updatedAt: true },
    })
    console.log('\nSample failed jobs:')
    for (const s of sample) {
        console.log(`  ${s.to} | attempts=${s.attempts} | claimedAt=${s.claimedAt?.toISOString() || 'null'} | error=${(s.error || '').slice(0, 100)}`)
    }

    await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
