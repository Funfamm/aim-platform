import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

// Simple in-memory rate limiter (per-IP, 120 req/min)
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120;
const RATE_WINDOW = 60_000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateMap) {
    if (now > entry.resetAt) rateMap.delete(ip);
  }
}, 5 * 60_000);

export async function POST(req: Request) {
  try {
    // Rate limit check
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json({ ok: false, error: 'rate limited' }, { status: 429 });
    }

    const body = await req.json();
    const { path, referrer, event, query, resultsCount, durationMs } = body;
    if (!path) return NextResponse.json({ ok: false }, { status: 400 });

    const userAgent = req.headers.get('user-agent') || '';
    // Detect device type from user agent
    let device = 'desktop';
    if (/mobile|android|iphone|ipad/i.test(userAgent)) {
      device = /ipad|tablet/i.test(userAgent) ? 'tablet' : 'mobile';
    }

    // Geo: Vercel injects this header on all requests (ISO-3166-1 alpha-2)
    const country = req.headers.get('x-vercel-ip-country') || null;

    // Session stitching: read or generate aim_sid cookie
    const cookieStore = await cookies();
    let sessionId = cookieStore.get('aim_sid')?.value || null;

    // Resolve userId from the custom session cookie
    let userId: string | null = null;
    try {
      const { getSession } = await import('@/lib/auth');
      const session = await getSession();
      userId = (session as { userId?: string } | null)?.userId ?? null;
    } catch {
      // non-critical — analytics still records the view without userId
    }

    // Build response so we can set cookie on new sessions
    const res = NextResponse.json({ ok: true });

    if (!sessionId) {
      sessionId = randomUUID();
      res.cookies.set('aim_sid', sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 90, // 90 days
      });
    }

    // Handle duration update for existing page view (unload event)
    if (event === 'unload' && typeof durationMs === 'number' && sessionId) {
      // Update the most recent PageView for this session+path with duration
      const recent = await (prisma as any).pageView.findFirst({
        where: { sessionId, path },
        orderBy: { createdAt: 'desc' },
        select: { id: true, durationMs: true },
      });
      if (recent && !recent.durationMs) {
        await (prisma as any).pageView.update({
          where: { id: recent.id },
          data: { durationMs: Math.min(durationMs, 3_600_000) }, // cap at 1 hour
        });
      }
      return res;
    }

    // Handle search analytics event
    if (event === 'search' && typeof query === 'string') {
      await (prisma as any).searchAnalytics.create({
        data: {
          query,
          resultsCount: typeof resultsCount === 'number' ? resultsCount : 0,
          device,
          userId,
        },
      });
    }

    // Record generic page view
    await (prisma as any).pageView.create({
      data: {
        path,
        userId,
        userAgent: userAgent.slice(0, 500),
        referrer: referrer?.slice(0, 500) || null,
        device,
        country,
        sessionId,
        event: event && event !== 'search' && event !== 'unload' ? String(event).slice(0, 64) : null,
      },
    });

    return res;
  } catch (error) {
    console.error('Analytics track error', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
