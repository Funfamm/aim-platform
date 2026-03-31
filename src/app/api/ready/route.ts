import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/ready
 * DB-backed readiness probe. Use for Render health checks and
 * pre-load-test "wait until ready" probes — not for k6 latency thresholds.
 * Returns 503 if the database is unreachable.
 */
export async function GET() {
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
