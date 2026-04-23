import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    const result = await db.siteSettings.updateMany({
        data: {
            emailTransport: 'smtp',
        }
    })
    console.log(`Updated ${result.count} record(s) — emailTransport switched to smtp`)
    
    // Verify
    const s = await db.siteSettings.findFirst({
        select: { emailTransport: true, smtpHost: true, smtpUser: true, smtpFromEmail: true, emailsEnabled: true }
    })
    console.log('Verified config:', JSON.stringify(s, null, 2))
}

main().catch(console.error).finally(() => prisma.$disconnect())
