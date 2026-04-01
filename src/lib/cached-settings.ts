/**
 * Cached Site Settings
 *
 * SiteSettings is queried on nearly every request (layout, auth providers, etc).
 * This module caches it in memory with a 2-minute TTL.
 *
 * Includes a safe fallback: if the DB query fails (e.g. during schema drift when
 * a migration hasn't run yet), it returns sensible defaults instead of crashing
 * the build or throwing a 500 on every page.
 */

import { prisma } from '@/lib/db'
import { cache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache'

/** Safe defaults used when siteSettings row is missing or DB schema is out of date */
const SETTINGS_DEFAULTS = {
    id: 'default',
    siteName: 'AIM Studio',
    tagline: 'AI-Powered Filmmaking',
    aboutText: '',
    studioStory: '',
    mission: '',
    aboutPageData: null as string | null,
    logoUrl: null as string | null,
    contactEmail: null as string | null,
    contactPhone: null as string | null,
    address: null as string | null,
    socialLinks: null as string | null,
    donationsEnabled: true,
    paypalClientId: null as string | null,
    paypalClientSecret: null as string | null,
    castingEnabled: true,
    castingCallsEnabled: true,
    scriptCallsEnabled: true,
    trainingEnabled: false,
    audioUploadEnabled: true,
    notifyOnNewRole: true,
    notifyOnAnnouncement: true,
    notifyOnContentPublish: false,
    googleAuthEnabled: false,
    appleAuthEnabled: false,
    geminiApiKey: null as string | null,
    smtpHost: null as string | null,
    smtpPort: null as number | null,
    smtpUser: null as string | null,
    smtpPass: null as string | null,
    smtpFrom: null as string | null,
    replyTo: null as string | null,
    searchBetaEnabled: false,
    updatedAt: new Date(),
}

async function fetchSettings() {
    try {
        const row = await prisma.siteSettings.findFirst()
        return row ?? SETTINGS_DEFAULTS
    } catch (err) {
        // Schema drift (e.g. migration not yet applied) — return safe defaults
        // so the build and page renders don't crash.
        console.warn('[AIM] siteSettings.findFirst() failed — returning defaults:', String(err))
        return SETTINGS_DEFAULTS
    }
}

export async function getCachedSettings() {
    return cache.get(
        CACHE_KEYS.SITE_SETTINGS,
        CACHE_TTL.MEDIUM, // 2 minutes
        fetchSettings
    )
}

/** Call after admin updates settings to immediately reflect changes */
export function invalidateSettings() {
    cache.invalidate(CACHE_KEYS.SITE_SETTINGS)
}
