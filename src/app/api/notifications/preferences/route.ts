import { NextResponse } from 'next/server';
import { getSessionAndRefresh } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { verifyCsrfToken } from '@/lib/csrf';
import { logPreferenceChange } from '@/lib/audit-log';

export async function GET() {
  const session = await getSessionAndRefresh();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const defaults = {
    newRole: true,
    announcement: true,
    contentPublish: false,
    statusChange: true,
    email: true,
    inApp: true,
    sms: false,
  };

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;
    let pref = await db.userNotificationPreference.findUnique({ where: { userId: session.userId } });

    if (!pref) {
      pref = await db.userNotificationPreference.create({
        data: {
          userId: session.userId,
          ...defaults,
        },
      });
    }

    return NextResponse.json({ preferences: pref });
  } catch (err) {
    // Graceful fallback: if the table/columns don't exist yet (migration drift),
    // return defaults so the UI still works.
    console.error('Notification preferences GET error:', err);
    return NextResponse.json({ preferences: { userId: session.userId, ...defaults } });
  }
}

export async function PUT(req: Request) {
  return savePreferences(req);
}

export async function POST(req: Request) {
  return savePreferences(req);
}

async function savePreferences(req: Request) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const csrfResp = verifyCsrfToken(req as any);
  if (csrfResp) return csrfResp;

  const session = await getSessionAndRefresh();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }

    const boolFields = ['newRole', 'announcement', 'contentPublish', 'statusChange', 'email', 'inApp', 'sms'];
    const data: Record<string, boolean> = {};

    for (const k of boolFields) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const val = (body as any)[k];
      if (typeof val === 'boolean') {
        data[k] = val;
      } else if (typeof val === 'string') {
        if (val.toLowerCase() === 'true') data[k] = true;
        else if (val.toLowerCase() === 'false') data[k] = false;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any;

    // Load old preferences for compliance diff
    const oldPref = await db.userNotificationPreference.findUnique({
      where: { userId: session.userId },
    });

    const pref = await db.userNotificationPreference.upsert({
      where: { userId: session.userId },
      update: data,
      create: {
        userId: session.userId,
        newRole: true,
        announcement: true,
        contentPublish: false,
        statusChange: true,
        email: true,
        inApp: true,
        sms: false,
        ...data,
      },
    });

    // ── Compliance audit: only log if something actually changed ──────────────
    if (Object.keys(data).length > 0) {
      const delta: Record<string, { from: unknown; to: unknown }> = {}
      for (const [key, newVal] of Object.entries(data)) {
        const oldVal = oldPref ? oldPref[key] : undefined
        if (oldVal !== newVal) {
          delta[key] = { from: oldVal, to: newVal }
        }
      }
      if (Object.keys(delta).length > 0) {
        // fire-and-forget — don't block the response
        void logPreferenceChange(session.userId, delta).catch(() => {})
      }
    }
    // ──────────────────────────────────────────────────────────────────────────

    return NextResponse.json({ preferences: pref });
  } catch (err) {
    console.error('Notification preferences save error:', err);
    return NextResponse.json(
      { error: 'Failed to save preferences', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

