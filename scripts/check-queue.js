const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
    const stuck = await p.emailQueue.findMany({
        where: { type: 'survey_campaign', status: 'processing' },
        select: { id: true, claimedAt: true, updatedAt: true, attempts: true, timeoutCount: true },
        take: 5,
    })
    console.log('Stuck processing jobs:')
    for (const s of stuck) {
        const age = s.claimedAt ? Math.round((Date.now() - s.claimedAt.getTime()) / 60000) : null
        console.log(`  claimedAt=${s.claimedAt?.toISOString() || 'null'} (${age}m ago) updatedAt=${s.updatedAt.toISOString()} attempts=${s.attempts} timeouts=${s.timeoutCount}`)
    }
    // Reset them
    const reset = await p.$queryRawUnsafe(`
        UPDATE "EmailQueue"
        SET status = 'pending', "claimedAt" = NULL, "updatedAt" = NOW(), "timeoutCount" = COALESCE("timeoutCount",0)+1
        WHERE status = 'processing' AND type = 'survey_campaign'
          AND ("claimedAt" IS NULL OR "claimedAt" < NOW() - INTERVAL '5 minutes')
        RETURNING id
    `)
    console.log(`\nRecovered ${reset.length} stuck jobs`)
    const q = await p.$queryRawUnsafe(`SELECT status, COUNT(*)::int as c FROM "EmailQueue" WHERE type='survey_campaign' GROUP BY status ORDER BY c DESC`)
    console.log('Queue:', JSON.stringify(q))
    await p.$disconnect()
}
main()
