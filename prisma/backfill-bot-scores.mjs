/**
 * Bot score backfill script — dry-run by default.
 *
 * Usage:
 *   node prisma/backfill-bot-scores.mjs            # dry-run (no DB writes)
 *   node prisma/backfill-bot-scores.mjs --apply    # writes new scores + BotScoreLog rows
 *
 * STOP: Do not run with --apply until the dry-run output has been reviewed.
 */

import { PrismaClient } from '@prisma/client'

const APPLY = process.argv.includes('--apply')

// ── Unified scoring constants (mirrors src/lib/botScore.ts) ─────────────────
const BOT_DISPOSABLE_DOMAINS = new Set([
    'emailax.pro', 'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
    'yopmail.com', 'trashmail.com', 'fakeinbox.com', 'sharklasers.com', 'dispostable.com',
    'mailnesia.com', 'tempail.com', 'temp-mail.org', 'mohmal.com', 'emailondeck.com',
    'getnada.com', '10minutemail.com', 'minutemail.com', 'maildrop.cc', 'mailcatch.com',
    'discard.email', 'tempr.email', 'temp-mail.io', 'guerrillamailblock.com', 'grr.la',
])
const BOT_SUSPECT_COUNTRIES = new Set(['RU', 'CN', 'VN', 'BD', 'PK', 'IN', 'BR', 'ID', 'NG'])

function calcBotScore(sub, hasOpened, signupVelocity) {
    let score = 0
    if (!sub.name)                                              score += 20
    if (!hasOpened)                                             score += 30
    if (sub.country && BOT_SUSPECT_COUNTRIES.has(sub.country)) score += 25
    if (signupVelocity >= 10)                                   score += 25
    else if (signupVelocity >= 5)                               score += 15
    const domain = sub.email.split('@')[1]?.toLowerCase()
    if (domain && BOT_DISPOSABLE_DOMAINS.has(domain))          score += 30
    return Math.min(score, 100)
}

const db = new PrismaClient()

async function main() {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`  Bot Score Backfill — ${APPLY ? '⚠️  APPLY MODE' : '✅ DRY-RUN (no writes)'}`)
    console.log(`${'═'.repeat(60)}\n`)

    // Load all subscribers
    const all = await db.subscriber.findMany({
        select: { id: true, email: true, name: true, country: true, botScore: true },
    })
    console.log(`Total subscribers: ${all.length}`)

    // Load all emails that have been opened (for hasOpened signal)
    const openedRecords = await db.emailLog.findMany({
        where: { openedAt: { not: null } },
        select: { to: true },
        distinct: ['to'],
    })
    const openedSet = new Set(openedRecords.map(r => r.to.toLowerCase()))

    // Load all Users for false-positive detection
    const allUsers = await db.user.findMany({ select: { email: true } })
    const userEmailSet = new Set(allUsers.map(u => u.email.toLowerCase()))

    // Signup velocity: total per country (proxy for surge signal)
    const countryGroups = await db.subscriber.groupBy({
        by: ['country'],
        _count: { country: true },
    })
    const countryCountMap = new Map(countryGroups.map(g => [g.country, g._count.country]))

    // Score categories
    const buckets = { '80+': 0, '60-79': 0, '40-59': 0, '20-39': 0, '0-19': 0 }
    const changes = { increases: [], decreases: [], unchanged: 0 }
    const crossingEighty = [] // will-cross-80 with enriched safety data

    for (const sub of all) {
        const hasOpened = openedSet.has(sub.email.toLowerCase())
        const velocity  = countryCountMap.get(sub.country) || 0
        const newScore  = calcBotScore(sub, hasOpened, velocity)
        const oldScore  = sub.botScore

        // Bucket the new score
        if      (newScore >= 80) buckets['80+']++
        else if (newScore >= 60) buckets['60-79']++
        else if (newScore >= 40) buckets['40-59']++
        else if (newScore >= 20) buckets['20-39']++
        else                     buckets['0-19']++

        if (newScore === oldScore) {
            changes.unchanged++
            continue
        }

        const entry = { email: sub.email, oldScore, newScore, delta: newScore - oldScore }

        if (newScore > oldScore)  changes.increases.push(entry)
        else                      changes.decreases.push(entry)

        // Flag any subscriber that would newly cross 80
        if (newScore >= 80 && oldScore < 80) {
            const isRegisteredUser   = userEmailSet.has(sub.email.toLowerCase())
            const isNonSuspectCountry = sub.country && !BOT_SUSPECT_COUNTRIES.has(sub.country)
            const hasSafetyFlag      = !!sub.name || isRegisteredUser || isNonSuspectCountry || hasOpened

            crossingEighty.push({
                email:              sub.email,
                country:            sub.country || '—',
                oldScore,
                newScore,
                hasName:            !!sub.name,
                isNonSuspectCountry: !!isNonSuspectCountry,
                hasUserAccount:     isRegisteredUser,
                hasEmailOpens:      hasOpened,
                potentialFalsePositive: hasSafetyFlag,
            })
        }
    }

    // ── Report ───────────────────────────────────────────────────────────────
    const totalChanges = changes.increases.length + changes.decreases.length
    console.log(`Scores that would change: ${totalChanges}`)
    console.log(`  Increases: ${changes.increases.length} (avg +${
        changes.increases.length
            ? Math.round(changes.increases.reduce((s, e) => s + e.delta, 0) / changes.increases.length)
            : 0
    } pts)`)
    console.log(`  Decreases: ${changes.decreases.length} (avg ${
        changes.decreases.length
            ? Math.round(changes.decreases.reduce((s, e) => s + e.delta, 0) / changes.decreases.length)
            : 0
    } pts)`)
    console.log(`  Unchanged: ${changes.unchanged}\n`)

    console.log('New score distribution (post-backfill):')
    for (const [band, count] of Object.entries(buckets)) {
        const bar = '█'.repeat(Math.round(count / all.length * 30))
        console.log(`  ${band.padEnd(6)}: ${String(count).padStart(4)}  ${bar}`)
    }

    console.log(`\nSubscribers crossing 80 threshold (next cron would delete): ${crossingEighty.length}`)

    if (crossingEighty.length > 0) {
        const flagged   = crossingEighty.filter(s => s.potentialFalsePositive)
        const cleanBots = crossingEighty.filter(s => !s.potentialFalsePositive)

        if (flagged.length > 0) {
            console.log(`\n⚠️  POTENTIAL FALSE POSITIVES (${flagged.length}) — review before backfilling:`)
            console.log('─'.repeat(120))
            console.log(
                'Email'.padEnd(40) +
                'Country'.padEnd(10) +
                'Old→New'.padEnd(12) +
                'Name?'.padEnd(8) +
                'NonSuspect?'.padEnd(14) +
                'UserAcct?'.padEnd(12) +
                'HasOpens?'
            )
            console.log('─'.repeat(120))
            for (const s of flagged) {
                console.log(
                    s.email.padEnd(40) +
                    s.country.padEnd(10) +
                    `${s.oldScore}→${s.newScore}`.padEnd(12) +
                    (s.hasName            ? '✓' : '✗').padEnd(8) +
                    (s.isNonSuspectCountry ? '✓' : '✗').padEnd(14) +
                    (s.hasUserAccount     ? '✓' : '✗').padEnd(12) +
                    (s.hasEmailOpens      ? '✓' : '✗')
                )
            }
        }

        if (cleanBots.length > 0) {
            console.log(`\n🤖 Clean bot crossings (${cleanBots.length}) — no safety flags:`)
            for (const s of cleanBots) {
                console.log(`  ${s.email} [${s.country}] ${s.oldScore}→${s.newScore}`)
            }
        }
    }

    if (!APPLY) {
        console.log('\n' + '═'.repeat(60))
        console.log('  DRY-RUN COMPLETE — no writes made.')
        console.log('  Review the false positive list above.')
        console.log('  When ready: node prisma/backfill-bot-scores.mjs --apply')
        console.log('═'.repeat(60) + '\n')
        await db.$disconnect()
        return
    }

    // ── Apply ────────────────────────────────────────────────────────────────
    console.log('\nApplying backfill...')
    const allChanges = [...changes.increases, ...changes.decreases]
    let written = 0

    for (const change of allChanges) {
        // Find the subscriber's ID for BotScoreLog
        const sub = all.find(s => s.email === change.email)
        if (!sub) continue

        await db.subscriber.update({
            where: { id: sub.id },
            data: { botScore: change.newScore },
        })

        await db.botScoreLog.create({
            data: {
                subscriberId: sub.id,
                email:        sub.email,
                oldScore:     change.oldScore,
                newScore:     change.newScore,
                reason:       'backfill',
            },
        })

        written++
        if (written % 50 === 0) process.stdout.write(`  ${written}/${allChanges.length}...\r`)
    }

    console.log(`\nBackfill complete. Updated ${written} subscribers.`)
    await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
