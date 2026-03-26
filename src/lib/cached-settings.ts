/**
 * Cached Site Settings
 *
 * SiteSettings is queried on nearly every request (layout, auth providers, etc).
 * This module caches it in memory with a 2-minute TTL.
 */

import { prisma } from '@/lib/db'
import { cache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache'

export async function getCachedSettings() {
    return cache.get(
        CACHE_KEYS.SITE_SETTINGS,
        CACHE_TTL.MEDIUM, // 2 minutes
        () => prisma.siteSettings.findFirst()
    )
}

/** Call after admin updates settings to immediately reflect changes */
export function invalidateSettings() {
    cache.invalidate(CACHE_KEYS.SITE_SETTINGS)
}
