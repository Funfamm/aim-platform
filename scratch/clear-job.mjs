import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const r = await p.subtitleJob.update({
  where: { id: 'cmoo9pj0f0000jx043d04wvd8' },
  data: { status: 'failed', errorMessage: 'Cleared stale job — worker was offline when queued' },
})
console.log('Done:', r.status)
await p.$disconnect()
