/**
 * GET /api/metrics
 * ---------------------------------------------------------------------------
 * Prometheus-compatible metrics endpoint.
 * Scraped by Grafana/Prometheus for observability.
 *
 * Security: restricted to internal networks (Render private IP range) or
 * requests with a valid METRICS_TOKEN header in production.
 *
 * To scrape from Grafana Cloud:
 *   URL:  https://impactaistudio.com/api/metrics
 *   Auth: Header — Authorization: Bearer <METRICS_TOKEN>
 */
import { NextResponse } from 'next/server'
import { getMetricsOutput } from '@/lib/metrics'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    // ── Auth: require METRICS_TOKEN in production ──────────────────────────
    if (process.env.NODE_ENV === 'production') {
        const expectedToken = process.env.METRICS_TOKEN
        if (expectedToken) {
            const authHeader = request.headers.get('authorization')
            const token = authHeader?.replace(/^Bearer\s+/i, '')
            if (token !== expectedToken) {
                return new Response('Unauthorized', { status: 401 })
            }
        }
    }

    const output = await getMetricsOutput()

    if (!output) {
        return NextResponse.json(
            { error: 'Metrics not available. Install prom-client: npm i prom-client' },
            { status: 503 }
        )
    }

    return new Response(output.body, {
        status: 200,
        headers: { 'Content-Type': output.contentType },
    })
}
