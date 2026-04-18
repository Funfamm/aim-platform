import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { hasAdminRole } from '@/lib/roles'
import { getS3Client } from '@/lib/r2Upload'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * GET /api/admin/subtitles/proxy-video?url=<encoded-url>
 *
 * Returns a short-lived pre-signed R2 URL the browser can fetch directly
 * (bypasses CORS + avoids streaming the entire video through Vercel).
 *
 * For non-R2 URLs (external CDN, etc.) falls back to a lightweight
 * server-side stream — but this is rare since films should be on R2.
 *
 * Admin-only — requires valid session.
 */
export async function GET(req: NextRequest) {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const session = await getUserSession()
    if (!session?.userId || !hasAdminRole(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = req.nextUrl.searchParams.get('url')
    if (!url) {
        return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
    }

    // Basic URL validation
    let parsed: URL
    try {
        parsed = new URL(url)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 })
        }
    } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    // ── Path 1: R2 URL → return a 15-minute presigned URL ───────────────────
    const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
    const r2BucketName = process.env.R2_BUCKET_NAME

    if (r2PublicUrl && r2BucketName && url.startsWith(r2PublicUrl)) {
        try {
            const key = url.slice(r2PublicUrl.length).replace(/^\//, '')
            const client = getS3Client()
            const command = new GetObjectCommand({ Bucket: r2BucketName, Key: key })
            // 15 minutes — more than enough for FFmpeg WASM to fetch the file
            const signedUrl = await getSignedUrl(client, command, { expiresIn: 900 })

            // Return JSON so the client can use the URL directly
            return NextResponse.json({ signedUrl })
        } catch (err) {
            console.error('[proxy-video] Failed to generate presigned URL:', err)
            // Fall through to streaming proxy below
        }
    }

    // ── Path 2: Non-R2 URL → stream through server (CORS bypass) ────────────
    // This handles edge cases: custom CDN domains, etc.
    try {
        const upstream = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIMStudio/1.0)' },
        })

        if (!upstream.ok) {
            return NextResponse.json(
                { error: `Upstream returned ${upstream.status}` },
                { status: upstream.status },
            )
        }

        const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
        const contentLength = upstream.headers.get('content-length')

        const headers: Record<string, string> = {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'private, no-store',
        }
        if (contentLength) headers['Content-Length'] = contentLength

        return new NextResponse(upstream.body, { status: 200, headers })
    } catch (err) {
        console.error('[proxy-video] Fetch error:', err)
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Proxy fetch failed' },
            { status: 502 },
        )
    }
}
