import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const jobs = await p.subtitleJob.findMany({
  where: { status: { in: ['queued', 'processing'] } },
  orderBy: { createdAt: 'desc' },
  take: 10,
  select: { id: true, projectId: true, status: true, createdAt: true, updatedAt: true },
})
console.log(JSON.stringify(jobs, null, 2))
await p.$disconnect()
