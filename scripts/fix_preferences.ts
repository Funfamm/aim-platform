// Run with: npx ts-node scripts/fix_preferences.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({ select: { id: true } })
  let created = 0

  for (const user of users) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    const existing = await db.userNotificationPreference.findUnique({ where: { userId: user.id } })
    if (!existing) {
      await db.userNotificationPreference.create({
        data: {
          userId: user.id,
          newRole: true,
          announcement: true,
          contentPublish: false,
          statusChange: true,
          email: true,
          inApp: true,
          sms: false,
        },
      })
      created++
      console.log('Created prefs for', user.id)
    }
  }

  console.log(`Done. Created ${created} / ${users.length} preference records.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
