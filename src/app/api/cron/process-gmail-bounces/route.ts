/**
 * GET /api/cron/process-gmail-bounces
 * ---------------------------------------------------------------------------
 * Gmail NDR (Non-Delivery Report) inbox poller.
 *
 * Reads the ai.impactmediastudio@gmail.com inbox for mailer-daemon NDR messages,
 * extracts the failed recipient, classifies the bounce, updates EmailLog, and
 * invokes the suppression engine — closing the bounce-tracking gap for Gmail SMTP.
 *
 * ACTIVATION: This cron is a no-op until GMAIL_REFRESH_TOKEN is set in env.
 *
 * To obtain GMAIL_REFRESH_TOKEN:
 *   1. Go to Google Cloud Console → your project → APIs & Services → Credentials
 *   2. Enable the Gmail API for this project
 *   3. Run the one-time OAuth flow for ai.impactmediastudio@gmail.com:
 *      npx ts-node scripts/gmail-oauth-init.ts
 *   4. Copy the refresh_token output into GMAIL_REFRESH_TOKEN env var
 *
 * Cron schedule (Vercel cron.json): every 15 minutes
 *   { "path": "/api/cron/process-gmail-bounces", "schedule": "*/15 * * * *" }
 *
 * Security: Protected by CRON_SECRET header (matches CRON_SECRET env var).
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { recordBounce, classifyBounceError } from '@/lib/suppression'
import { logger } from '@/lib/logger'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1'
const OAUTH_URL = 'https://oauth2.googleapis.com/token'

// ── Gmail API helpers ───────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
    const res = await fetch(OAUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id:     process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: process.env.GMAIL_REFRESH_TOKEN!,
            grant_type:    'refresh_token',
        }),
    })
    const data = await res.json() as { access_token?: string; error?: string }
    if (!data.access_token) throw new Error(`OAuth token refresh failed: ${data.error}`)
    return data.access_token
}

async function gmailGet(path: string, token: string) {
    const res = await fetch(`${GMAIL_API}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Gmail API ${path} → ${res.status}`)
    return res.json()
}

async function markAsRead(messageId: string, token: string) {
    await fetch(`${GMAIL_API}/users/me/messages/${messageId}/modify`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    })
}

// ── NDR parsing ─────────────────────────────────────────────────────────────

/**
 * Extract the failed recipient from an NDR/bounce email body.
 * NDRs typically contain the original recipient in headers or body text.
 */
function extractBounceRecipient(body: string): string | null {
    // Final-Recipient header (RFC 3464 DSN format)
    const dsnMatch = body.match(/Final-Recipient:\s*rfc822;\s*([\w.+\-]+@[\w.\-]+)/i)
    if (dsnMatch) return dsnMatch[1].toLowerCase()

    // Original-Recipient header
    const origMatch = body.match(/Original-Recipient:\s*rfc822;\s*([\w.+\-]+@[\w.\-]+)/i)
    if (origMatch) return origMatch[1].toLowerCase()

    // "failed permanently" / "not delivered to" patterns
    const failMatch = body.match(/(?:delivery to|failed permanently|could not be delivered to|undeliverable to)[:\s]+([\w.+\-]+@[\w.\-]+)/i)
    if (failMatch) return failMatch[1].toLowerCase()

    // Fallback: first email-like address that looks like a recipient
    const emailMatch = body.match(/To:\s*([\w.+\-]+@[\w.\-]+)/i)
    if (emailMatch) return emailMatch[1].toLowerCase()

    return null
}

function decodeBase64Url(s: string): string {
    return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBody(payload: any): string {
    if (payload?.body?.data) return decodeBase64Url(payload.body.data)
    if (payload?.parts) {
        for (const part of payload.parts) {
            const text = extractBody(part)
            if (text) return text
        }
    }
    return ''
}

// ── Cron handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    // Security: only callable by Vercel cron or with the correct secret
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
        const auth = request.headers.get('authorization')
        if (auth !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    // ── Not activated yet ──────────────────────────────────────────────────
    if (!process.env.GMAIL_REFRESH_TOKEN) {
        return NextResponse.json({
            status: 'inactive',
            message: 'GMAIL_REFRESH_TOKEN not configured. Set this env var to activate Gmail NDR polling. See route file for setup instructions.',
        })
    }

    try {
        const token = await getAccessToken()

        // Search for unread NDR messages from mailer-daemon/postmaster
        // Gmail search operators: unread, from mailer-daemon, in inbox, last 24h
        const since = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000)
        const query  = `is:unread (from:mailer-daemon OR from:postmaster) after:${since}`

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const list = await gmailGet(`/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`, token) as any
        const messages: { id: string }[] = list.messages || []

        if (messages.length === 0) {
            return NextResponse.json({ status: 'ok', processed: 0, message: 'No new NDRs' })
        }

        let processedCount = 0
        let failedCount = 0

        for (const { id } of messages) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const msg = await gmailGet(`/users/me/messages/${id}?format=full`, token) as any
                const body = extractBody(msg.payload)
                const recipient = extractBounceRecipient(body)

                if (!recipient) {
                    logger.warn('cron/gmail-bounces', `Could not extract recipient from NDR ${id}`)
                    await markAsRead(id, token)
                    continue
                }

                // Classify bounce from body content
                const category = classifyBounceError(body)

                // Record in suppression engine + update EmailLog
                await recordBounce(recipient, category, `Gmail NDR: ${body.slice(0, 500)}`, 'mailer')

                // Write back to the most recent EmailLog for this recipient
                await (prisma as any).$executeRawUnsafe(`
                    UPDATE "EmailLog"
                    SET success = false,
                        "bounceCategory" = $2,
                        error = $3
                    WHERE id = (
                        SELECT id FROM "EmailLog"
                        WHERE "to" = $1
                          AND success = true
                          AND "bounceCategory" IS NULL
                          AND transport = 'smtp'
                        ORDER BY "sentAt" DESC
                        LIMIT 1
                    )
                `, recipient, category, `Gmail NDR processed at ${new Date().toISOString()}`.slice(0, 2000))

                // Mark NDR as read in Gmail so we don't re-process it
                await markAsRead(id, token)

                logger.info('cron/gmail-bounces', `Processed NDR for ${recipient} (${category})`)
                processedCount++
            } catch (err) {
                logger.error('cron/gmail-bounces', `Failed to process NDR ${id}`, { error: err as Error })
                failedCount++
            }
        }

        return NextResponse.json({
            status: 'ok',
            total: messages.length,
            processed: processedCount,
            failed: failedCount,
        })
    } catch (err) {
        logger.error('cron/gmail-bounces', 'Gmail NDR polling failed', { error: err as Error })
        return NextResponse.json({ error: 'Internal error', detail: String(err) }, { status: 500 })
    }
}
