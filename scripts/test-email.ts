/**
 * End-to-end email test: seeds DB settings and sends a test email
 * Usage: npx tsx scripts/test-email.ts <transport> [recipient]
 *   transport: "graph" or "smtp"
 */
import { prisma } from '../src/lib/db'
import { sendTestEmail, invalidateMailerCache } from '../src/lib/mailer'

async function main() {
    const transport = (process.argv[2] || 'smtp') as 'graph' | 'smtp'
    const recipient = process.argv[3] || 'ai.impactmediastudio@gmail.com'

    console.log(`\n🔧 Testing ${transport.toUpperCase()} email transport`)
    console.log(`📧 Recipient: ${recipient}\n`)

    const baseData = {
        emailsEnabled: true,
        emailTransport: transport,
        smtpFromName: 'AIM Studio',
        smtpFromEmail: transport === 'graph' ? 'aimstudio@impactaistudio.com' : 'ai.impactmediastudio@gmail.com',
        emailReplyTo: 'noreply@impactaistudio.com',
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.siteSettings as any).upsert({
        where: { id: 'default' },
        update: transport === 'smtp'
            ? { ...baseData, smtpHost: 'smtp.gmail.com', smtpPort: 465, smtpSecure: true, smtpUser: 'ai.impactmediastudio@gmail.com', smtpPass: 'tscz rfzu esel eovz' }
            : baseData,
        create: transport === 'smtp'
            ? { id: 'default', ...baseData, smtpHost: 'smtp.gmail.com', smtpPort: 465, smtpSecure: true, smtpUser: 'ai.impactmediastudio@gmail.com', smtpPass: 'tscz rfzu esel eovz' }
            : { id: 'default', ...baseData },
    })

    console.log(`✅ DB seeded — From: ${baseData.smtpFromEmail}, Reply-To: ${baseData.emailReplyTo}`)
    invalidateMailerCache()

    try {
        await sendTestEmail(recipient)
        console.log(`\n✅ ${transport.toUpperCase()} email sent successfully!`)
        console.log(`📬 Check ${recipient} inbox`)
        console.log(`↩️  Reply-To is set to: noreply@impactaistudio.com`)
    } catch (err) {
        console.error(`\n❌ ${transport.toUpperCase()} FAILED:`)
        console.error(err instanceof Error ? err.message : err)
        process.exit(1)
    }

    await prisma.$disconnect()
}

main()
