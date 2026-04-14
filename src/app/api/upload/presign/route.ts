import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// ── S3-compatible client for Cloudflare R2 ─────────────────────────────────
const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
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
const ALLOWED_VIDEO_TYPES = [
    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    'video/x-matroska', 'video/ogg',
]
const ALLOWED_DOCUMENT_TYPES = [
    'application/pdf',
    'application/x-fdx',
    'application/vnd.final-draft',
    'text/plain',
    'application/octet-stream',
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
            name = '',
            castingCallId = 'unknown',
            scriptCallId = 'unknown',
        } = body as {
            fileName: string
            fileType: string
            kind: 'image' | 'audio' | 'document' | 'video'
            name?: string
            castingCallId?: string
            scriptCallId?: string
        }

        if (!fileName || !fileType || !kind) {
            return NextResponse.json({ error: 'Missing fileName, fileType or kind' }, { status: 400 })
        }

        // Video uploads are admin-only — gate with session check
        if (kind === 'video') {
            try { await requireAdmin() } catch {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }

        // ── Infer MIME from extension when browser sends empty/generic type ──
        // iOS Safari commonly sends '' or 'application/octet-stream' for HEIC
        let resolvedType = fileType
        if (!resolvedType || resolvedType === 'application/octet-stream') {
            const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
            const mimeMap: Record<string, string> = {
                jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
                webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
                mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav',
                webm: kind === 'video' ? 'video/webm' : 'audio/webm',
                ogg: kind === 'video' ? 'video/ogg' : 'audio/ogg',
                flac: 'audio/flac', aac: 'audio/aac',
                mp4: kind === 'video' ? 'video/mp4' : 'audio/mp4',
                mov: 'video/quicktime', avi: 'video/x-msvideo',
                mkv: 'video/x-matroska',
            }
            resolvedType = mimeMap[ext] || fileType
        }

        // ── Content-type allowlist ──────────────────────────────────────────
        if (kind === 'image' && !ALLOWED_IMAGE_TYPES.includes(resolvedType)) {
            return NextResponse.json({ error: `Unsupported image type: ${resolvedType}` }, { status: 400 })
        }
        if (kind === 'audio' && !ALLOWED_AUDIO_TYPES.includes(resolvedType)) {
            return NextResponse.json({ error: `Unsupported audio type: ${resolvedType}` }, { status: 400 })
        }
        if (kind === 'video' && !ALLOWED_VIDEO_TYPES.includes(resolvedType)) {
            return NextResponse.json({ error: `Unsupported video type: ${resolvedType}. Allowed: MP4, WebM, MOV, AVI, MKV.` }, { status: 400 })
        }
        if (kind === 'document') {
            const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
            const allowedExts = ['pdf', 'fdx', 'txt', 'fountain']
            if (!allowedExts.includes(ext) && !ALLOWED_DOCUMENT_TYPES.includes(resolvedType)) {
                return NextResponse.json({ error: `Unsupported document type. Please upload PDF, FDX, or TXT.` }, { status: 400 })
            }
        }

        // ── Build folder path ────────────────────────────────────────────────
        // Pattern: casting/calls/{castingCallId}/{nameSlug}-{hash}/{photos|audio}/{ts}-{uuid}.ext
        // Each casting call has its own isolated folder so the AI agent can
        // scan exactly one casting call's applicants without trawling all uploads.
        const nameSlug   = name ? slugify(name) : 'applicant'
        const nameHash   = shortHash(name || 'applicant')
        const category   = kind === 'image' ? 'photos' : kind === 'audio' ? 'audio' : kind === 'video' ? 'videos' : 'scripts'
        const folder     = kind === 'document'
            ? `scripts/calls/${scriptCallId}/${nameSlug}-${nameHash}/scripts`
            : kind === 'video'
            ? `uploads/videos/admin`
            : `casting/calls/${castingCallId}/${nameSlug}-${nameHash}/${category}`
        const ext        = extFrom(fileName)
        const r2Key      = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`

        // ── Generate presigned PUT URL (10-minute window) ────────────────────
        const command = new PutObjectCommand({
            Bucket: BUCKET,
            Key: r2Key,
            ContentType: resolvedType,
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
