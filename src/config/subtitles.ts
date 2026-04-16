/**
 * src/config/subtitles.ts — Centralised subtitle configuration.
 *
 * All subtitle-related constants live here (OCP Fix).
 * Adding a new streaming host, changing chunk size, or updating
 * the translator provider is a data/config change — NO source file
 * across the pipeline needs to be edited.
 *
 * Re-exports the canonical language lists from subtitle-languages.ts
 * so callers only need one import path.
 */

export {
    SUBTITLE_TARGET_LANGS,
    LANGUAGE_NAMES,
    TOTAL_SUBTITLE_LANGS,
    getLangName,
    type SubtitleLangCode,
} from '@/lib/subtitle-languages'

// ── Translation chunking ───────────────────────────────────────────────────────

/**
 * Maximum subtitle segments per Gemini call.
 * Keeps prompts within model token limits for all film lengths.
 * Increase for short films / decrease for very long films if needed.
 */
export const MAX_SEGMENTS_PER_CALL = 500

// ── URL compatibility ──────────────────────────────────────────────────────────

/**
 * Streaming/hosting platforms whose URLs are incompatible with browser-side
 * Whisper transcription (they block fetch() via CORS or are not direct media URLs).
 *
 * OCP: add new hosts here — no other file needs to change.
 * Each entry is matched against the film URL's hostname via `hostname.endsWith(host)`.
 */
export const BLOCKED_STREAMING_HOSTS: readonly string[] = [
    'youtube.com',
    'youtu.be',
    'vimeo.com',
    'player.vimeo.com',
    'drive.google.com',
    'dropbox.com',
    'dai.ly',
    'dailymotion.com',
    'twitch.tv',
    'facebook.com',
    'instagram.com',
    'tiktok.com',
]

/**
 * Returns true if the given URL belongs to a platform that blocks browser fetch.
 * Returns false for empty/invalid URLs (safe default — let the request proceed and fail naturally).
 */
export function isBlockedStreamingUrl(url: string): { blocked: boolean; hostname: string } {
    let hostname = ''
    try {
        hostname = new URL(url).hostname.replace(/^www\./, '')
    } catch {
        return { blocked: false, hostname: '' }
    }
    const blocked = BLOCKED_STREAMING_HOSTS.some(h => hostname.endsWith(h))
    return { blocked, hostname }
}

// ── Publish validation ─────────────────────────────────────────────────────────

/**
 * Project statuses that are publicly visible to end-users.
 * The publish gate applies when saving a project with one of these statuses.
 */
export const PUBLIC_PROJECT_STATUSES: readonly string[] = ['completed', 'in-production']

/**
 * Returns whether a project with the given status and film URL should
 * require translation confirmation before saving.
 */
export function requiresTranslationGate(
    status: string,
    filmUrl: string | undefined | null,
): boolean {
    return PUBLIC_PROJECT_STATUSES.includes(status) && !!filmUrl
}
