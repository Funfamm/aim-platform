import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'

/**
 * GET /api/admin/subtitles/proxy-video?url=<encoded-url>
 *
 * Streams a remote video file through the server to bypass CORS restrictions.
 * Used by the client-side transcription pipeline when the browser cannot
 * directly fetch the film URL (e.g. Google Drive, Dropbox, etc.).
 *
 * Admin-only — requires valid session.
 */
export async function GET(req: NextRequest) {
    try {
        await requireAdmin()
    } catch {
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

    try {
        const upstream = await fetch(url, {
            headers: {
                // Pass through a reasonable user-agent so hosts don't reject the request
                'User-Agent': 'Mozilla/5.0 (compatible; AIMStudio/1.0)',
            },
        })

        if (!upstream.ok) {
            return NextResponse.json(
                { error: `Upstream returned ${upstream.status}` },
                { status: upstream.status },
            )
        }

        // Stream the response body through to the client
        const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
        const contentLength = upstream.headers.get('content-length')

        const headers: Record<string, string> = {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'private, no-store',
        }
        if (contentLength) {
            headers['Content-Length'] = contentLength
        }

        return new NextResponse(upstream.body, { status: 200, headers })
    } catch (err) {
        console.error('[proxy-video] Fetch error:', err)
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Proxy fetch failed' },
            { status: 502 },
        )
    }
}
