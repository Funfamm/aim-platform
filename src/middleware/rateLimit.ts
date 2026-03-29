import { NextRequest, NextResponse } from 'next/server';

// Simple in‑memory store: IP -> timestamps of recent requests
const requestLog = new Map<string, number[]>();
const LIMIT = 30; // requests per minute
const WINDOW_MS = 60 * 1000; // 1 minute

export function middleware(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  const now = Date.now();
  const timestamps = requestLog.get(ip) ?? [];
  // Keep only timestamps within the window
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);

  if (recent.length > LIMIT) {
    return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/search/:path*', // apply only to search API routes
};
