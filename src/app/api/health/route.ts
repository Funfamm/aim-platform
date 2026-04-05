import { NextResponse } from 'next/server'

/**
 * GET /api/health
 * Liveness probe — always returns 200 so CI wait-on never hangs.
 * Redis is optional; reported as "disabled" when REDIS_URL is not set.
 */
export async function GET() {
  // Redis status — gracefully disabled when REDIS_URL is absent (CI / local dev)
  let redis: 'up' | 'down' | 'disabled' = 'disabled'
  if (process.env.REDIS_URL) {
    try {
      // Lazy import so BullMQ is never loaded unless Redis is configured
      const { getNotificationQueue } = await import('@/lib/queues/notificationQueue')
      const q = getNotificationQueue()
      // BullMQ Queue exposes a client property; a simple isPaused() ping is enough
      // We wrap it in a timeout because if Upstash Redis quota is reached, ioredis connects forever and hangs.
      if (q) {
        await Promise.race([
          q.isPaused(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 2000))
        ])
        redis = 'up'
      }
    } catch {
      redis = 'down'
    }
  }

  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: { redis },
    },
    { status: 200 }   // always 200 so CI health probes succeed
  )
}

/**
 * POST /api/health
 * DB-backed readiness probe. Use for Render health checks and
 * "wait until DB is up" probes — not for k6 latency thresholds.
 */
export async function POST() {
  const { prisma } = await import('@/lib/db')
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ready' }, { status: 200 })
  } catch (err) {
    return NextResponse.json(
      { status: 'unavailable', error: String(err) },
      { status: 503 }
    )
  }
}
