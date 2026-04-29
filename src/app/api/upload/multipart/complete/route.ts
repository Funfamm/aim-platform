import { NextRequest, NextResponse } from 'next/server'
import { S3Client, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3'
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

/**
 * POST /api/upload/multipart/complete
 *
 * Body: { r2Key, uploadId, parts: [{ PartNumber, ETag }] }
 * Returns: { finalUrl }
 *
 * Completes the multipart upload, assembling all parts into a single object.
 */
export async function POST(req: NextRequest) {
    try {
        await requireAdmin()
    } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { r2Key, uploadId, parts } = await req.json()

        if (!r2Key || !uploadId || !Array.isArray(parts) || parts.length === 0) {
            return NextResponse.json({ error: 'Missing r2Key, uploadId, or parts' }, { status: 400 })
        }

        // Sort parts by PartNumber (required by S3)
        const sortedParts = parts
            .map((p: { PartNumber: number; ETag: string }) => ({
                PartNumber: p.PartNumber,
                ETag: p.ETag,
            }))
            .sort((a: { PartNumber: number }, b: { PartNumber: number }) => a.PartNumber - b.PartNumber)

        const command = new CompleteMultipartUploadCommand({
            Bucket: BUCKET,
            Key: r2Key,
            UploadId: uploadId,
            MultipartUpload: { Parts: sortedParts },
        })

        await s3.send(command)

        const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
        const finalUrl = r2PublicUrl ? `${r2PublicUrl}/${r2Key}` : r2Key

        return NextResponse.json({ finalUrl })
    } catch (error) {
        console.error('[Multipart/Complete] Failed:', error)
        return NextResponse.json({ error: 'Failed to complete multipart upload' }, { status: 500 })
    }
}
