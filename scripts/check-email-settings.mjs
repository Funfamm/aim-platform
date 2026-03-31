import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const settings = await prisma.siteSettings.findFirst({
    select: { id: true, emailsEnabled: true, smtpFromEmail: true, smtpUser: true, smtpFromName: true }
})

console.log('SiteSettings:', JSON.stringify(settings, null, 2))

if (settings) {
    if (!settings.emailsEnabled) {
        console.log('\n⚠️  emailsEnabled is FALSE — enabling now...')
        await prisma.siteSettings.update({
            where: { id: settings.id },
            data: { emailsEnabled: true }
        })
        console.log('✅ emailsEnabled set to TRUE')
    } else {
        console.log('\n✅ emailsEnabled is already TRUE')
    }
} else {
    console.log('\n⚠️  No SiteSettings row found — creating one with emailsEnabled: true...')
    await prisma.siteSettings.create({
        data: { emailsEnabled: true }
    })
    console.log('✅ SiteSettings created with emailsEnabled: true')
}

await prisma.$disconnect()
