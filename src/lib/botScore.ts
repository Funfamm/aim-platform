/**
 * Canonical bot scoring module — single source of truth.
 *
 * Used by:
 *   - /api/subscribe/route.ts          (score at signup, stored to DB)
 *   - /api/admin/subscribers/route.ts  (score for display + stats)
 *   - /api/admin/subscribers/bot-suspects/route.ts
 *   - /api/track/open/[id]/route.ts    (rescore on email open)
 *   - prisma/backfill-bot-scores.mjs   (backfill script)
 *
 * Weights (resolved from the May-3 hardening commit — highest intentional values):
 *   No name:           +20
 *   Never opened:      +30
 *   Suspect country:   +25
 *   Country surge ≥10: +25
 *   Country surge ≥5:  +15
 *   Disposable domain: +30
 *   Max: 100
 *
 * Score bands: 0-39 = Low, 40-69 = Medium, 70-100 = High
 * Cron deletes: >= 80
 */

export const BOT_DISPOSABLE_DOMAINS = new Set([
    'emailax.pro', 'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
    'yopmail.com', 'trashmail.com', 'fakeinbox.com', 'sharklasers.com', 'dispostable.com',
    'mailnesia.com', 'tempail.com', 'temp-mail.org', 'mohmal.com', 'emailondeck.com',
    'getnada.com', '10minutemail.com', 'minutemail.com', 'maildrop.cc', 'mailcatch.com',
    'discard.email', 'tempr.email', 'temp-mail.io', 'guerrillamailblock.com', 'grr.la',
])

/** ISO country codes considered high-risk for bot activity. Single source — do not duplicate. */
export const BOT_SUSPECT_COUNTRIES = new Set([
    'RU', 'CN', 'VN', 'BD', 'PK', 'IN', 'BR', 'ID', 'NG',
])

export interface BotScoreResult {
    score: number
    breakdown: Record<string, number>
}

/**
 * Calculate bot risk score (0–100) for a subscriber.
 *
 * @param sub            Subscriber fields needed for scoring
 * @param hasOpened      True if subscriber has opened at least one email
 * @param signupVelocity How many subscribers from the same country in the same signup window
 */
export function calcBotScore(
    sub: { email: string; name: string | null; country: string | null },
    hasOpened: boolean,
    signupVelocity: number,
): BotScoreResult {
    const breakdown: Record<string, number> = {}
    let score = 0

    if (!sub.name) {
        breakdown.noName = 20; score += 20
    }
    if (!hasOpened) {
        breakdown.neverOpened = 30; score += 30
    }
    if (sub.country && BOT_SUSPECT_COUNTRIES.has(sub.country)) {
        breakdown.suspectCountry = 25; score += 25
    }
    if (signupVelocity >= 10) {
        breakdown.countrySurge = 25; score += 25
    } else if (signupVelocity >= 5) {
        breakdown.countrySurge = 15; score += 15
    }
    const domain = sub.email.split('@')[1]?.toLowerCase()
    if (domain && BOT_DISPOSABLE_DOMAINS.has(domain)) {
        breakdown.disposableDomain = 30; score += 30
    }

    return { score: Math.min(score, 100), breakdown }
}

/** Human-readable flags for the Bot Cleanup panel. */
export const BOT_EMAIL_PATTERN = /^[a-z]{5,}\d{5,}@/i

export function getBotFlags(sub: {
    email: string
    name: string | null
    country: string | null
    botScore: number
    hasOpened: boolean
}): string[] {
    const flags: string[] = []
    const domain = sub.email.split('@')[1]?.toLowerCase()
    if (domain && BOT_DISPOSABLE_DOMAINS.has(domain)) flags.push('Disposable domain')
    if (!sub.name) flags.push('No name provided')
    if (sub.country && BOT_SUSPECT_COUNTRIES.has(sub.country)) flags.push(`High-risk country (${sub.country})`)
    if (!sub.hasOpened) flags.push('Never opened any email')
    if (BOT_EMAIL_PATTERN.test(sub.email)) flags.push('Bot-pattern email address')
    if (sub.botScore >= 70) flags.push(`High bot score (${sub.botScore}/100)`)
    else if (sub.botScore >= 40) flags.push(`Medium bot score (${sub.botScore}/100)`)
    return flags
}
