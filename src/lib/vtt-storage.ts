/**
 * vtt-storage.ts
 *
 * Manages VTT subtitle file caching in Cloudflare R2.
 * Files are stored with version-hashed keys so re-translations
 * bust stale CDN/browser caches automatically.
 *
 * Storage path: subtitles/{projectId}/{lang}-{hash8}.vtt
 *
 * ENV VARS REQUIRED (same as videoStorage.ts):
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
 *   R2_ACCOUNT_ID, R2_PUBLIC_URL (optional — bypasses signed URL generation)
 */

import { createHmac, createHash } from 'crypto'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

// ── R2 client ───────────────────────────────────────────────────────────────
function getR2Client(): S3Client {
    const accountId = process.env.R2_ACCOUNT_ID
    if (!accountId) throw new Error('[vtt-storage] R2_ACCOUNT_ID is not set')
    return new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
        },
    })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic 8-char hash of content for cache-busting */
function contentHash8(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 8)
}

function hmac(key: string | Buffer, data: string): Buffer {
    return createHmac('sha256', key).update(data).digest()
}

/** Convert segments to WebVTT format */
export function segmentsToVtt(segments: { start: number; end: number; text: string }[]): string {
    const pad = (n: number) => String(Math.floor(n)).padStart(2, '0')
    const formatTime = (s: number) => {
        const h = Math.floor(s / 3600)
        const m = Math.floor((s % 3600) / 60)
        const sec = Math.floor(s % 60)
        const ms = Math.round((s % 1) * 1000)
        return `${pad(h)}:${pad(m)}:${pad(sec)}.${String(ms).padStart(3, '0')}`
    }
    const cues = segments
        .filter(s => s.text?.trim())
        .map((s, i) =>
            `${i + 1}\n${formatTime(s.start)} --> ${formatTime(s.end)} line:85% align:center\n${s.text.trim()}`
        )
        .join('\n\n')
    return `WEBVTT\n\n${cues}`
}

/**
 * Uploads a VTT file to R2 and returns the R2 object key.
 * Key is versioned with a content hash so re-translations bust caches.
 */
export async function cacheVttToR2(
    projectId: string,
    lang: string,
    segments: { start: number; end: number; text: string }[]
): Promise<string> {
    const vttContent = segmentsToVtt(segments)
    const hash = contentHash8(vttContent)
    const key = `subtitles/${projectId}/${lang}-${hash}.vtt`
    const bucket = process.env.R2_BUCKET_NAME
    if (!bucket) throw new Error('[vtt-storage] R2_BUCKET_NAME is not set')

    const client = getR2Client()
    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: vttContent,
        ContentType: 'text/vtt',
        CacheControl: 'public, max-age=31536000, immutable', // versioned key → safe to cache forever
    }))

    return key
}

/**
 * Returns the public or signed URL for a cached VTT file.
 * Returns null if the key is not found in vttPaths.
 */
export function getVttUrl(lang: string, vttPaths: Record<string, string> | null | undefined): string | null {
    if (!vttPaths?.[lang]) return null
    const key = vttPaths[lang]

    // Fast path: public R2 dev URL
    const publicUrl = process.env.R2_PUBLIC_URL
    if (publicUrl) {
        return `${publicUrl.replace(/\/$/, '')}/${key}`
    }

    // Fall back to account-based endpoint (unsigned — bucket must allow public read)
    const accountId = process.env.R2_ACCOUNT_ID
    if (accountId) {
        const bucket = process.env.R2_BUCKET_NAME
        return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`
    }

    return null
}

/**
 * Generates and caches VTT for all provided languages.
 * Returns a map of lang → R2 key for each successfully cached language.
 * Errors per-language are caught and logged; partial success is returned.
 */
export async function cacheAllLanguageVtts(
    projectId: string,
    langSegments: Record<string, { start: number; end: number; text: string }[]>
): Promise<Record<string, string>> {
    const results: Record<string, string> = {}
    for (const [lang, segments] of Object.entries(langSegments)) {
        try {
            results[lang] = await cacheVttToR2(projectId, lang, segments)
        } catch (err) {
            console.error(`[vtt-storage] Failed to cache VTT for lang=${lang} project=${projectId}`, err)
        }
    }
    return results
}
