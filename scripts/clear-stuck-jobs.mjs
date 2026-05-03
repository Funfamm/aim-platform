import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const result = await prisma.subtitleJob.updateMany({
    where: { status: { in: ['queued', 'processing'] } },
    data: { status: 'failed', errorMessage: 'Manually cleared — worker restarted' },
})

console.log(`✅ Cleared ${result.count} stuck job(s)`)
await prisma.$disconnect()
