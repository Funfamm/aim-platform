const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
    // Reset stuck 'processing' emails back to 'pending'
    const result = await p.$queryRawUnsafe(`
        UPDATE "EmailQueue"
        SET status = 'pending', "updatedAt" = NOW()
        WHERE status = 'processing'
          AND type = 'survey_campaign'
          AND "updatedAt" < NOW() - INTERVAL '3 minutes'
        RETURNING id
    `)
    console.log(`Reset ${result.length} stuck 'processing' emails back to 'pending'`)
    await p.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
