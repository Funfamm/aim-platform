import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const projects = await p.project.findMany({
  select: { id: true, title: true, projectType: true },
  take: 5,
  orderBy: { createdAt: 'desc' },
})
console.log(JSON.stringify(projects, null, 2))
await p.$disconnect()
