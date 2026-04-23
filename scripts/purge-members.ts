import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    // Safety: NEVER delete superadmin or admin accounts
    const members = await db.user.findMany({
        where: { role: 'member' },
        select: { id: true, email: true, name: true },
    })

    if (members.length === 0) {
        console.log('No member accounts found. Nothing to delete.')
        return
    }

    console.log('\n⚠️  The following member accounts will be PERMANENTLY DELETED:')
    members.forEach((u: any) => console.log(`  - ${u.email} (${u.name || 'no name'})`))
    console.log(`\n  Total: ${members.length} accounts`)
    console.log('  Superadmin and Admin accounts are protected and will NOT be deleted.\n')

    const ids = members.map((u: any) => u.id)
    const emails = members.map((u: any) => u.email)

    // Hard purge all related data
    await db.$transaction(async (tx: any) => {
        // Delete notifications
        await tx.userNotification.deleteMany({ where: { userId: { in: ids } } })
        // Delete notification preferences
        await tx.userNotificationPreference.deleteMany({ where: { userId: { in: ids } } })
        // Delete applications (by userId and email)
        await tx.application.deleteMany({ where: { userId: { in: ids } } })
        await tx.application.deleteMany({ where: { email: { in: emails } } })
        // Delete donations
        await tx.donation.deleteMany({ where: { userId: { in: ids } } })
        await tx.donation.deleteMany({ where: { email: { in: emails } } })
        // Delete script submissions
        await tx.scriptSubmission.deleteMany({ where: { authorEmail: { in: emails } } })
        // Delete the users themselves (cascades sessions, accounts, etc.)
        await tx.user.deleteMany({ where: { id: { in: ids } } })
    })

    console.log(`✅ Purged ${members.length} member accounts and all their related data.`)
    console.log('   Admin and superadmin accounts are untouched.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
