const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
    // Reset jobs that failed only due to worker timeouts (not actual send failures)
    const result = await p.emailQueue.updateMany({
        where: {
            type: 'survey_campaign',
            status: 'failed',
            error: 'Max attempts exceeded after repeated worker timeouts',
        },
        data: {
            status: 'pending',
            attempts: 0,
            claimedAt: null,
            error: null,
        },
    })
    console.log(`Reset ${result.count} timeout-failed jobs back to pending for retry`)

    // Also reset any stuck processing
    const stuck = await p.$queryRawUnsafe(`
        UPDATE "EmailQueue"
        SET status = 'pending', "claimedAt" = NULL, attempts = 0, "updatedAt" = NOW()
        WHERE status = 'processing'
          AND type = 'survey_campaign'
          AND ("claimedAt" IS NULL OR "claimedAt" < NOW() - INTERVAL '5 minutes')
        RETURNING id
    `)
    console.log(`Reset ${stuck.length} stuck processing jobs`)

    // Show new totals
    const counts = await p.$queryRawUnsafe(`
        SELECT status, COUNT(*)::int as count
        FROM "EmailQueue" WHERE type = 'survey_campaign'
        GROUP BY status ORDER BY count DESC
    `)
    console.log('\nNew queue status:')
    for (const r of counts) console.log(`  ${r.status}: ${r.count}`)

    await p.$disconnect()
}
main().catch(e => { console.error(e); process.exit(1) })
