import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

/**
 * GET /api/health
 * Pure process-level liveness probe — NO database access.
 * Safe to hit under load; always returns 200 unless the process is down.
 */
export async function GET() {
  return NextResponse.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    { status: 200 }
  )
}

/**
 * GET /api/ready
 * DB-backed readiness probe. Use this for Render health checks and
 * "wait until DB is up" probes — not for k6 latency thresholds.
 */
export async function POST() {
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
