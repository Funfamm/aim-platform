/**
 * Seed / backfill UserNotificationPreference for all existing users.
 * Run once after the schema migration:
 *   npx tsx scripts/seed-notification-prefs.ts
 */
import { prisma } from '../src/lib/db'

async function main() {
    console.log('🔔 Backfilling notification preferences for existing users...')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    const users = await prisma.user.findMany({ select: { id: true, email: true } })
    console.log(`Found ${users.length} users`)

    let created = 0
    let skipped = 0

    for (const user of users) {
        const existing = await db.userNotificationPreference.findUnique({
            where: { userId: user.id }
        })
        if (existing) {
            skipped++
            continue
        }

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
            }
        })
        created++
        console.log(`  ✅ Created prefs for ${user.email}`)
    }

    console.log(`\n✅ Done! Created: ${created}, Skipped (already had prefs): ${skipped}`)
    await prisma.$disconnect()
}

main().catch(e => {
    console.error(e)
    process.exit(1)
})
