const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
    const result = await p.subtitleJob.updateMany({
        where: { status: { in: ['queued', 'processing'] } },
        data: { status: 'failed', errorMessage: 'Cleared: worker was offline' }
    })
    console.log('Cleared', result.count, 'stuck jobs')
    await p.$disconnect()
}

main().catch(e => { console.error(e); p.$disconnect() })
