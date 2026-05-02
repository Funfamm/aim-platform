/**
 * scripts/backfill-bot-score.ts
 *
 * One-off script: calculates botScore for all existing subscribers using
 * the same signals as the admin panel and persists the result to the DB.
 *
 * Run ONCE after the migration that adds botScore to the Subscriber table:
 *   npx ts-node --project tsconfig.json scripts/backfill-bot-score.ts
 *
 * Safe to re-run — it overwrites existing scores.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ── Same domain/country sets as subscribe route and admin panel ─────────────
const DISPOSABLE_DOMAINS = new Set([
    'emailax.pro', 'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
    'yopmail.com', 'trashmail.com', 'fakeinbox.com', 'sharklasers.com', 'dispostable.com',
    'mailnesia.com', 'tempail.com', 'temp-mail.org', 'mohmal.com', 'emailondeck.com',
    'getnada.com', '10minutemail.com', 'minutemail.com', 'maildrop.cc', 'mailcatch.com',
    'discard.email', 'tempr.email', 'temp-mail.io', 'guerrillamailblock.com', 'grr.la',
])
const SUSPECT_COUNTRIES = new Set(['RU', 'CN', 'VN', 'BD', 'PK', 'IN', 'BR', 'ID', 'NG'])

function calcBotScore(
    email: string,
    name: string | null,
    country: string | null,
    hasOpened: boolean,
    countryCount: number,
): number {
    let score = 0
    if (!name) score += 15
    if (!hasOpened) score += 30
    const domain = email.split('@')[1]?.toLowerCase()
    if (domain && DISPOSABLE_DOMAINS.has(domain)) score += 25
    if (country && SUSPECT_COUNTRIES.has(country)) score += 20
    if (countryCount >= 10) score += 20
    else if (countryCount >= 5) score += 10
    return Math.min(score, 100)
}

async function main() {
    console.log('🤖 Starting botScore backfill…')

    // Load all subscribers
    const subs = await prisma.subscriber.findMany({
        select: { id: true, email: true, name: true, country: true },
    })
    console.log(`   Found ${subs.length} subscribers`)

    // Load all emails that have opened at least one email
    const openedRecords = await (prisma as any).emailLog.findMany({
        where: { openedAt: { not: null } },
        select: { to: true },
        distinct: ['to'],
    }) as { to: string }[]
    const openedSet = new Set(openedRecords.map((r: { to: string }) => r.to.toLowerCase()))

    // Country subscriber counts (signup velocity proxy)
    const countryGroups = await prisma.subscriber.groupBy({
        by: ['country'],
        _count: { country: true },
    }) as { country: string | null; _count: { country: number } }[]
    const countryCountMap = new Map(countryGroups.map(g => [g.country, g._count.country]))

    // Compute and batch-update
    let updated = 0
    const BATCH = 100
    for (let i = 0; i < subs.length; i += BATCH) {
        const batch = subs.slice(i, i + BATCH)
        await Promise.all(batch.map(s => {
            const score = calcBotScore(
                s.email,
                s.name,
                s.country,
                openedSet.has(s.email.toLowerCase()),
                countryCountMap.get(s.country) ?? 0,
            )
            return prisma.subscriber.update({
                where: { id: s.id },
                data: { botScore: score },
            })
        }))
        updated += batch.length
        console.log(`   Updated ${updated}/${subs.length}…`)
    }

    console.log(`✅ Backfill complete — ${subs.length} subscribers scored.`)
}

main()
    .catch(err => { console.error('❌ Backfill failed:', err); process.exit(1) })
    .finally(() => prisma.$disconnect())
