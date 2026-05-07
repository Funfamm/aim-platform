import { NextRequest, NextResponse } from 'next/server'
import { S3Client, CreateMultipartUploadCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'
import { requireAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
})

const BUCKET = process.env.R2_BUCKET_NAME!

function extFrom(filename: string) {
    const i = filename.lastIndexOf('.')
    return i >= 0 ? filename.slice(i).toLowerCase().replace(/[^a-z0-9.]/g, '') : ''
}

/**
 * POST /api/upload/multipart/create
 *
 * Body: { fileName, fileType }
 * Returns: { uploadId, r2Key, finalUrl }
 *
 * Initiates an S3 multipart upload. Admin-only.
 */
export async function POST(req: NextRequest) {
    try {
        await requireAdmin()
    } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { fileName, fileType } = await req.json()

        if (!fileName || !fileType) {
            return NextResponse.json({ error: 'Missing fileName or fileType' }, { status: 400 })
        }

        const ext = extFrom(fileName)
        const r2Key = `uploads/videos/admin/${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`

        const command = new CreateMultipartUploadCommand({
            Bucket: BUCKET,
            Key: r2Key,
            ContentType: fileType,
            CacheControl: 'public, max-age=31536000, immutable',
        })

        const result = await s3.send(command)

        const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
        const finalUrl = r2PublicUrl ? `${r2PublicUrl}/${r2Key}` : r2Key

        return NextResponse.json({
            uploadId: result.UploadId,
            r2Key,
            finalUrl,
        })
    } catch (error) {
        console.error('[Multipart/Create] Failed:', error)
        return NextResponse.json({ error: 'Failed to create multipart upload' }, { status: 500 })
    }
}
