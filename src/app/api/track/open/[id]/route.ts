import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 1x1 transparent GIF (43 bytes)
const PIXEL = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
)

/**
 * GET /api/track/open/[id]
 * Tracking pixel endpoint — marks an EmailLog as opened.
 * Returns a 1x1 transparent GIF with aggressive no-cache headers.
 * Analytics are best-effort: failures never produce visible errors.
 */
export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: trackingId } = await params

    // Fire-and-forget: update openedAt if not already set
    if (trackingId) {
        prisma.emailLog.updateMany({
            where: {
                trackingId,
                openedAt: null, // only set on first open
            },
            data: { openedAt: new Date() },
        }).catch(() => { /* non-critical */ })
    }

    return new NextResponse(PIXEL, {
        status: 200,
        headers: {
            'Content-Type': 'image/gif',
            'Content-Length': String(PIXEL.length),
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        },
    })
}
