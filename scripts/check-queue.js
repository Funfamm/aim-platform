const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
async function main() {
    const q = await p.$queryRawUnsafe(`SELECT status, COUNT(*)::int as c FROM "EmailQueue" WHERE type='survey_campaign' GROUP BY status ORDER BY c DESC`)
    console.log(new Date().toISOString(), 'Queue:', JSON.stringify(q))
    await p.$disconnect()
}
main()
