import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// ── S3-compatible client for Cloudflare R2 ─────────────────────────────────
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

const BUCKET = process.env.R2_BUCKET_NAME!

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const ALLOWED_AUDIO_TYPES = [
    'audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/x-wav',
    'audio/webm', 'audio/ogg', 'audio/aac', 'audio/m4a', 'audio/x-m4a', 'audio/flac',
]

function slugify(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)
}

function shortHash(value: string) {
    return crypto.createHash('sha256').update(value.toLowerCase()).digest('hex').slice(0, 8)
}

function extFrom(filename: string) {
    const i = filename.lastIndexOf('.')
    return i >= 0 ? filename.slice(i).toLowerCase().replace(/[^a-z0-9.]/g, '') : ''
}

/**
 * POST /api/upload/presign
 *
 * Body: { fileName, fileType, kind: 'image'|'audio', castingCallId?, email? }
 *
 * Returns: { presignedUrl, finalUrl, r2Key }
 *
 * The presignedUrl is a short-lived R2 PUT URL — the browser should PUT
 * the raw file directly to it. Zero bytes pass through Vercel.
 *
 * R2 key structure (collision-safe, human-readable, no raw PII):
 *   casting/applications/{castingCallId}-{emailSlug}-{emailHash}/{photos|audio}/{ts}-{uuid}.{ext}
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const {
            fileName,
            fileType,
            kind,
            castingCallId = 'unknown',
            email = '',
        } = body as {
            fileName: string
            fileType: string
            kind: 'image' | 'audio'
            castingCallId?: string
            email?: string
        }

        if (!fileName || !fileType || !kind) {
            return NextResponse.json({ error: 'Missing fileName, fileType or kind' }, { status: 400 })
        }

        // ── Content-type allowlist ──────────────────────────────────────────
        if (kind === 'image' && !ALLOWED_IMAGE_TYPES.includes(fileType)) {
            return NextResponse.json({ error: `Unsupported image type: ${fileType}` }, { status: 400 })
        }
        if (kind === 'audio' && !ALLOWED_AUDIO_TYPES.includes(fileType)) {
            return NextResponse.json({ error: `Unsupported audio type: ${fileType}` }, { status: 400 })
        }

        // ── Build collision-safe folder path ────────────────────────────────
        // Pattern: casting/applications/{castingCallId}-{emailSlug}-{emailHash}/{photos|audio}/
        // - castingCallId: unique per role × applicant combo after DB insert (or 'draft' pre-submit)
        // - emailSlug: human-readable (e.g. "samuel-aderemi-gmail-com")
        // - emailHash: first 8 chars of SHA256(email) — prevents collision without exposing PII
        const emailSlug = email ? slugify(email.replace('@', '-').replace(/\./g, '-')) : 'guest'
        const hash      = email ? shortHash(email) : crypto.randomUUID().slice(0, 8)
        const category  = kind === 'image' ? 'photos' : 'audio'
        const safeId    = castingCallId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || 'draft'

        const folder = `casting/applications/${safeId}-${emailSlug}-${hash}/${category}`
        const ext    = extFrom(fileName)
        const r2Key  = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`

        // ── Generate presigned PUT URL (10-minute window) ────────────────────
        const command = new PutObjectCommand({
            Bucket: BUCKET,
            Key: r2Key,
            ContentType: fileType,
        })

        const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 600 })

        // ── Permanent public URL (used after upload completes) ───────────────
        const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
        const finalUrl    = r2PublicUrl ? `${r2PublicUrl}/${r2Key}` : r2Key

        return NextResponse.json({ presignedUrl, finalUrl, r2Key })

    } catch (error) {
        console.error('[Presign] URL generation failed:', error)
        return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
    }
}
