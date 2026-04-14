require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

async function main() {
    const p = new PrismaClient()
    try {
        const events = await p.liveEvent.findMany({
            select: {
                id: true,
                roomName: true,
                status: true,
                title: true,
                startedAt: true,
                endedAt: true,
                eventType: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        })
        console.log('LiveEvents in DB:', events.length)
        events.forEach(e => console.log(JSON.stringify(e, null, 2)))
    } finally {
        await p['$disconnect']()
    }
}
main().catch(console.error)
