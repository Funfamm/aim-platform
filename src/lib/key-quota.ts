/**
 * key-quota.ts
 *
 * Manages per-API-key quota windows so the audit worker never burns
 * through free-tier limits in a single burst.
 *
 * Each ApiKey has a matching ApiKeyQuota row (created lazily on first use).
 * The quota tracks how many calls have been made in the current window and
 * when the window resets (defaults to 24 hours).
 */

import { prisma } from '@/lib/db'

const DEFAULT_WINDOW_HOURS = 24
const DEFAULT_MAX_CALLS = 50

/**
 * Resets any quota windows whose `windowResetAt` is in the past.
 * Call this at the very start of each cron run.
 */
export async function resetExpiredWindows(): Promise<number> {
    const result = await (prisma.apiKeyQuota as any).updateMany({
        where: { windowResetAt: { lte: new Date() } },
        data: {
            usedInWindow: 0,
            windowResetAt: new Date(Date.now() + DEFAULT_WINDOW_HOURS * 60 * 60 * 1000),
            cooldownUntil: null,
        },
    })
    if (result.count > 0) {
        console.log(`[KeyQuota] Reset ${result.count} expired window(s)`)
    }
    return result.count
}

/**
 * Returns the first available, active ApiKey that still has quota remaining
 * and is not in a cooldown period.
 * Returns null if no key is available.
 */
export async function getAvailableKey(): Promise<{ id: string; key: string; provider: string } | null> {
    const now = new Date()

    // Load all active keys with their quota; keys with no quota row are eligible (treated as fresh)
    const keys = await (prisma.apiKey as any).findMany({
        where: { isActive: true },
        include: { quota: true },
        orderBy: { lastUsed: 'asc' }, // prefer least-recently-used
    })

    for (const apiKey of keys) {
        const quota = apiKey.quota

        // No quota row yet → eligible (will be created on first consumeKey call)
        if (!quota) return { id: apiKey.id, key: apiKey.key, provider: apiKey.provider }

        // Skip if in cooldown
        if (quota.cooldownUntil && quota.cooldownUntil > now) continue

        // Skip if window is exhausted
        if (quota.usedInWindow >= quota.windowMaxCalls) continue

        return { id: apiKey.id, key: apiKey.key, provider: apiKey.provider }
    }

    return null
}

/**
 * Records usage of a key after a successful AI call.
 * Creates the ApiKeyQuota row lazily if it doesn't exist yet.
 */
export async function consumeKey(apiKeyId: string): Promise<void> {
    const now = new Date()

    const existing = await (prisma.apiKeyQuota as any).findUnique({ where: { apiKeyId } })

    if (!existing) {
        // First use — create quota row
        await (prisma.apiKeyQuota as any).create({
            data: {
                apiKeyId,
                windowMaxCalls: DEFAULT_MAX_CALLS,
                usedInWindow: 1,
                windowResetAt: new Date(now.getTime() + DEFAULT_WINDOW_HOURS * 60 * 60 * 1000),
            },
        })
    } else {
        await (prisma.apiKeyQuota as any).update({
            where: { apiKeyId },
            data: { usedInWindow: { increment: 1 } },
        })
    }

    // Update ApiKey.lastUsed / usageCount
    await (prisma.apiKey as any).update({
        where: { id: apiKeyId },
        data: {
            lastUsed: now,
            usageCount: { increment: 1 },
        },
    })
}

/**
 * Puts a key into cooldown (e.g. after a rate-limit or auth error from the AI provider).
 */
export async function cooldownKey(apiKeyId: string, minutes = 60): Promise<void> {
    const cooldownUntil = new Date(Date.now() + minutes * 60 * 1000)
    const existing = await (prisma.apiKeyQuota as any).findUnique({ where: { apiKeyId } })
    if (existing) {
        await (prisma.apiKeyQuota as any).update({ where: { apiKeyId }, data: { cooldownUntil } })
    } else {
        await (prisma.apiKeyQuota as any).create({
            data: {
                apiKeyId,
                windowMaxCalls: DEFAULT_MAX_CALLS,
                usedInWindow: 0,
                windowResetAt: new Date(Date.now() + DEFAULT_WINDOW_HOURS * 60 * 60 * 1000),
                cooldownUntil,
            },
        })
    }
    console.log(`[KeyQuota] Key ${apiKeyId} cooled down until ${cooldownUntil.toISOString()}`)
}
