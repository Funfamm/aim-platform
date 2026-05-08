import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const rows = await p.pageMedia.findMany({
  where: { page: 'home' },
  orderBy: { sortOrder: 'asc' },
})
console.log(JSON.stringify(rows, null, 2))
await p.$disconnect()
