import { NextRequest, NextResponse } from 'next/server'
import { S3Client, CopyObjectCommand } from '@aws-sdk/client-s3'
import { getUserSession } from '@/lib/auth'
import crypto from 'crypto'

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

function slugify(value: string) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

function shortHash(value: string) {
    return crypto.createHash('sha256').update(value.toLowerCase()).digest('hex').slice(0, 8)
}

function extFrom(key: string) {
    const i = key.lastIndexOf('.')
    return i >= 0 ? key.slice(i).toLowerCase() : ''
}

/**
 * POST /api/upload/copy
 *
 * Server-side R2 copy — zero bytes from the browser.
 * Used when an applicant reuses saved media for a new casting call.
 *
 * Body: { sourceUrl, castingCallId, slot, name }
 * Returns: { finalUrl }
 */
export async function POST(req: NextRequest) {
    try {
        // Must be authenticated
        const session = await getUserSession()
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { sourceUrl, castingCallId, slot, name = '' } = await req.json() as {
            sourceUrl: string
            castingCallId: string
            slot: string
            name?: string
        }

        if (!sourceUrl || !castingCallId || !slot) {
            return NextResponse.json({ error: 'Missing sourceUrl, castingCallId or slot' }, { status: 400 })
        }

        // Extract the R2 key from the public URL
        const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
        if (!r2PublicUrl || !sourceUrl.startsWith(r2PublicUrl)) {
            return NextResponse.json({ error: 'Source URL is not an R2 URL' }, { status: 400 })
        }
        const sourceKey = sourceUrl.slice(r2PublicUrl.length + 1)

        // Build destination key under the new casting call folder
        const nameSlug  = name ? slugify(name) : 'applicant'
        const nameHash  = shortHash(name || 'applicant')
        const category  = slot === 'voiceRecording' ? 'audio' : 'photos'
        const ext       = extFrom(sourceKey)
        const destKey   = `casting/calls/${castingCallId}/${nameSlug}-${nameHash}/${category}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`

        // Server-side copy within R2 (no data transfer cost)
        await s3.send(new CopyObjectCommand({
            Bucket: BUCKET,
            CopySource: `${BUCKET}/${sourceKey}`,
            Key: destKey,
        }))

        const finalUrl = `${r2PublicUrl}/${destKey}`
        return NextResponse.json({ finalUrl })

    } catch (error) {
        console.error('[Upload/Copy] R2 copy failed:', error)
        return NextResponse.json({ error: 'Failed to copy file' }, { status: 500 })
    }
}
