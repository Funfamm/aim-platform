/**
 * POST /api/admin/subscribers/delete-high-risk
 * ---------------------------------------------------------------
 * Protected admin endpoint that bulk‑deletes bot subscribers with a
 * configurable botScore threshold (default 80). The request body may
 * optionally include a custom `threshold` field.
 *
 * Returns JSON: { deleted: number, total: number, threshold: number }
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { autoDeleteHighRiskBots, getBotDeleteThreshold } from '@/lib/botCleanup'
import { logger } from '@/lib/logger'

export async function POST(req: Request) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { threshold?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const threshold = typeof body.threshold === 'number' ? body.threshold : getBotDeleteThreshold()
  const adminUserId = (req as any).user?.id ?? null // requireAdmin may attach user info

  try {
    const result = await autoDeleteHighRiskBots(threshold, 'admin_bulk', adminUserId)
    return NextResponse.json({
      status: 'ok',
      threshold,
      total: result.total,
      deleted: result.deleted,
    })
  } catch (err) {
    logger.error('admin/delete-high-risk', 'Failed', { error: err as Error })
    return NextResponse.json({ error: 'Internal error', detail: String(err) }, { status: 500 })
  }
}
