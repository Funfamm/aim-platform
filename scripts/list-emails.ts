import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any

    console.log('\n══════════════════════════════════════════')
    console.log('  REGISTERED USERS + RELATED DATA COUNTS')
    console.log('══════════════════════════════════════════\n')

    const users = await db.user.findMany({
        select: {
            id: true, email: true, name: true, role: true, createdAt: true,
            _count: {
                select: {
                    applications: true,
                    donations: true,
                    notifications: true,
                }
            }
        },
        orderBy: { createdAt: 'desc' },
    })

    users.forEach((u: any) => {
        const counts = `apps=${u._count.applications} donations=${u._count.donations} notifs=${u._count.notifications}`
        console.log(`  [${u.role.padEnd(10)}] ${u.email.padEnd(42)} | ${counts} | joined ${new Date(u.createdAt).toLocaleDateString()}`)
    })

    console.log(`\n  Total users: ${users.length}`)
    console.log(`  Admins/Superadmins: ${users.filter((u: any) => u.role !== 'member').length}`)
    console.log(`  Regular members: ${users.filter((u: any) => u.role === 'member').length}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
