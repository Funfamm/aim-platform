import { NextRequest, NextResponse } from 'next/server'
import { S3Client, UploadPartCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
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
 * POST /api/upload/multipart/sign-part
 *
 * Body: { r2Key, uploadId, partNumber }
 * Returns: { presignedUrl }
 *
 * Generates a presigned URL for uploading a single part.
 * The browser PUTs the chunk directly to R2 using this URL.
 */
export async function POST(req: NextRequest) {
    try {
        await requireAdmin()
    } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const { r2Key, uploadId, partNumber } = await req.json()

        if (!r2Key || !uploadId || !partNumber) {
            return NextResponse.json({ error: 'Missing r2Key, uploadId, or partNumber' }, { status: 400 })
        }

        const command = new UploadPartCommand({
            Bucket: BUCKET,
            Key: r2Key,
            UploadId: uploadId,
            PartNumber: partNumber,
        })

        // 30-minute window per part (large parts may take time on slow connections)
        const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 1800 })

        return NextResponse.json({ presignedUrl })
    } catch (error) {
        console.error('[Multipart/SignPart] Failed:', error)
        return NextResponse.json({ error: 'Failed to sign part' }, { status: 500 })
    }
}
