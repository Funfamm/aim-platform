/**
 * backfill-r2-cache-headers.mjs
 *
 * One-time script: copies every object in the R2 bucket to itself with
 * CacheControl: 'public, max-age=31536000, immutable' metadata.
 *
 * Uses S3 CopyObject (same-bucket copy) which preserves data in-place
 * while updating metadata — no re-upload required.
 *
 * Run from the project root:
 *   node scratch/backfill-r2-cache-headers.mjs
 *
 * Requires env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 * (reads from .env.local automatically via the dotenv line below)
 */

import { S3Client, ListObjectsV2Command, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync } from 'fs'

// ── Load .env.local manually ──────────────────────────────────────────────────
try {
  const env = readFileSync('.env.local', 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?(.+?)"?\s*$/)
    if (m) process.env[m[1]] = m[2]
  }
} catch { /* .env.local not found — rely on real env */ }

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
  console.error('Missing R2 env vars. Export them or ensure .env.local is present.')
  process.exit(1)
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

// Only patch static image/video assets — not VTT subtitles, JSON, etc.
// Adjust this list if needed.
const PATCH_CONTENT_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/avif', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/mp4', 'audio/ogg',
  'application/octet-stream', // covers unknowns
])

const TARGET_CACHE = 'public, max-age=31536000, immutable'

let listed = 0, patched = 0, skipped = 0, errors = 0
let continuationToken = undefined

console.log(`Scanning bucket: ${R2_BUCKET_NAME}`)

do {
  const listCmd = new ListObjectsV2Command({
    Bucket: R2_BUCKET_NAME,
    MaxKeys: 1000,
    ContinuationToken: continuationToken,
  })
  const page = await s3.send(listCmd)

  for (const obj of page.Contents ?? []) {
    listed++
    const key = obj.Key

    // Check current headers
    let head
    try {
      head = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))
    } catch {
      console.warn(`  WARN: HEAD failed for ${key}`)
      errors++
      continue
    }

    // Already has the right header — skip
    if (head.CacheControl === TARGET_CACHE) {
      skipped++
      continue
    }

    // Skip non-media content types unless already unset
    const ct = head.ContentType ?? ''
    const baseType = ct.split(';')[0].trim()
    if (!PATCH_CONTENT_TYPES.has(baseType) && head.CacheControl) {
      skipped++
      continue
    }

    // Copy-to-self with new CacheControl
    try {
      await s3.send(new CopyObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        CopySource: `${R2_BUCKET_NAME}/${key}`,
        ContentType: head.ContentType,
        CacheControl: TARGET_CACHE,
        MetadataDirective: 'REPLACE',
      }))
      patched++
      console.log(`  ✓ Patched: ${key} (was: "${head.CacheControl ?? 'none'}")`)
    } catch (err) {
      console.error(`  ✗ Failed: ${key}`, err.message)
      errors++
    }
  }

  continuationToken = page.NextContinuationToken
} while (continuationToken)

console.log(`\nDone. Listed: ${listed}, Patched: ${patched}, Skipped: ${skipped}, Errors: ${errors}`)
