const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
    // Check ALL survey_campaign email logs — not just campaign@system
    const allLogs = await p.emailLog.findMany({
        where: { type: 'survey_campaign' },
        orderBy: { sentAt: 'desc' },
    })
    console.log(`Total survey_campaign EmailLog entries: ${allLogs.length}`)
    for (const log of allLogs) {
        console.log(`  to=${log.to}, success=${log.success}, sentAt=${log.sentAt?.toISOString()}, transport=${log.transport}`)
    }

    // The cooldown check in the send API looks for:
    // type: 'survey_campaign', success: true, sentAt >= 30 days ago
    const recentCampaign = await p.emailLog.findFirst({
        where: {
            type: 'survey_campaign',
            sentAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            success: true,
        },
        orderBy: { sentAt: 'desc' },
    })
    console.log('\nCooldown-triggering entry:', recentCampaign ? JSON.stringify({
        id: recentCampaign.id,
        to: recentCampaign.to,
        sentAt: recentCampaign.sentAt,
        subject: recentCampaign.subject,
    }) : 'NONE')

    await p.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
