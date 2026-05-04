/**
 * GET  /api/subscribe/confirm?token=...
 *   → Shows a confirmation landing page (does NOT activate the subscriber yet).
 *     This defeats Gmail/Outlook link-scanners that GET the URL silently —
 *     they never POST, so the token is not consumed until the user clicks.
 *
 * POST /api/subscribe/confirm?token=...
 *   → Activates the subscriber, clears token, sends welcome email.
 *
 * Redirects to /[locale]/subscribe/confirmed?status=success|expired|invalid|error
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { subscribeWelcomeWithOverrides } from '@/lib/email-templates'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function lookupToken(token: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    return db.subscriber.findFirst({
        where: { confirmToken: token },
        select: { id: true, email: true, name: true, locale: true, tokenExpiresAt: true },
    })
}

function isExpired(tokenExpiresAt: Date | null): boolean {
    return !!(tokenExpiresAt && new Date(tokenExpiresAt) < new Date())
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — show landing page only, do NOT consume the token
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
        return NextResponse.redirect(`${siteUrl}/en/subscribe/confirmed?status=invalid`)
    }

    try {
        const subscriber = await lookupToken(token)

        if (!subscriber) {
            return NextResponse.redirect(`${siteUrl}/en/subscribe/confirmed?status=invalid`)
        }

        if (isExpired(subscriber.tokenExpiresAt)) {
            const encodedEmail = encodeURIComponent(subscriber.email)
            return NextResponse.redirect(
                `${siteUrl}/en/subscribe/confirmed?status=expired&email=${encodedEmail}`
            )
        }

        // ── Return a minimal landing page that POST-submits the token ──────
        // Link-scanners (Gmail, Outlook ATP) follow GET links but never submit forms.
        // Real users click "Complete Subscription" which fires the POST below.
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirm your AIM Studio subscription</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0a0a10;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
    .card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:48px 40px;max-width:480px;width:100%;text-align:center}
    .icon{font-size:56px;margin-bottom:20px}
    h1{font-size:1.5rem;font-weight:800;margin-bottom:12px;color:#fff}
    p{color:rgba(255,255,255,0.6);font-size:0.92rem;line-height:1.6;margin-bottom:28px}
    button{background:#D4AF37;color:#000;border:none;padding:14px 36px;font-size:1rem;font-weight:700;border-radius:8px;cursor:pointer;width:100%;transition:opacity 0.2s}
    button:hover{opacity:0.88}
    button:active{opacity:0.75}
    .note{font-size:0.75rem;color:rgba(255,255,255,0.3);margin-top:16px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📬</div>
    <h1>Almost there!</h1>
    <p>Click the button below to confirm your AIM Studio subscription and start receiving updates about our films, casting calls, and exclusive announcements.</p>
    <form method="POST" action="/api/subscribe/confirm?token=${encodeURIComponent(token)}">
      <button type="submit">Complete My Subscription →</button>
    </form>
    <p class="note">This link expires in 72 hours. If you did not subscribe, you can safely close this page.</p>
  </div>
</body>
</html>`

        return new NextResponse(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })

    } catch (err) {
        console.error('[subscribe/confirm] GET error:', err)
        return NextResponse.redirect(`${siteUrl}/en/subscribe/confirmed?status=error`)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — actually activate the subscriber (only humans reach this)
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
        return NextResponse.redirect(`${siteUrl}/en/subscribe/confirmed?status=invalid`)
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const subscriber = await lookupToken(token)

        if (!subscriber) {
            return NextResponse.redirect(`${siteUrl}/en/subscribe/confirmed?status=invalid`)
        }

        if (isExpired(subscriber.tokenExpiresAt)) {
            const encodedEmail = encodeURIComponent(subscriber.email)
            return NextResponse.redirect(
                `${siteUrl}/en/subscribe/confirmed?status=expired&email=${encodedEmail}`
            )
        }

        // ── Activate subscriber ───────────────────────────────────────────────
        await db.subscriber.update({
            where: { id: subscriber.id },
            data: {
                active: true,
                confirmToken: null,
                tokenExpiresAt: null,
                confirmedAt: new Date(),
            },
        })

        // ── Send welcome email ────────────────────────────────────────────────
        const locale = subscriber.locale || 'en'
        sendEmail({
            to: subscriber.email,
            subject: 'Welcome to AIM Studio! 🎬',
            html: await subscribeWelcomeWithOverrides(subscriber.name || undefined, siteUrl, locale),
            type: 'authentication',
            isTransactional: true,
        }).catch(err => console.error('[subscribe/confirm] Welcome email failed:', err))

        return NextResponse.redirect(`${siteUrl}/en/subscribe/confirmed?status=success`)
    } catch (err) {
        console.error('[subscribe/confirm] POST error:', err)
        return NextResponse.redirect(`${siteUrl}/en/subscribe/confirmed?status=error`)
    }
}
