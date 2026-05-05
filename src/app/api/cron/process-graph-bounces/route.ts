/**
 * GET /api/cron/process-graph-bounces
 * ---------------------------------------------------------------------------
 * Microsoft Graph NDR (Non-Delivery Report) inbox poller.
 *
 * Reads the Graph sender mailbox for NDR bounce-back messages,
 * extracts the failed recipient, classifies the bounce, updates EmailLog,
 * and invokes the suppression engine — closing the bounce-tracking gap
 * for emails sent via Microsoft Graph.
 *
 * ACTIVATION: Requires AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
 *             and Mail.Read permission on the Azure AD app registration.
 *
 * Cron schedule (Vercel cron.json): every 15 minutes
 *   { "path": "/api/cron/process-graph-bounces", "schedule": "*\/15 * * * *" }
 *
 * Security: Protected by CRON_SECRET header (matches CRON_SECRET env var).
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getGraphAccessToken } from '@/lib/graphClient'
import { recordBounce, classifyBounceError } from '@/lib/suppression'
import { logger } from '@/lib/logger'

// ── Config ──────────────────────────────────────────────────────────────────

/** The mailbox that sends email via Graph — NDR replies arrive here */
function getSenderMailbox(): string {
    // Priority: admin DB setting > env var > default
    return process.env.GRAPH_EMAIL_SENDER || 'aimstudio@impactaistudio.com'
}

// ── Graph API helpers ───────────────────────────────────────────────────────

interface GraphMessage {
    id: string
    subject: string
    isRead: boolean
    receivedDateTime: string
    body: { contentType: string; content: string }
    from?: { emailAddress?: { address?: string } }
}

interface GraphMessageList {
    value: GraphMessage[]
    '@odata.nextLink'?: string
}

async function graphGet<T>(url: string, token: string): Promise<T> {
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Graph API ${res.status}: ${body}`)
    }
    return res.json() as Promise<T>
}

async function markAsRead(mailbox: string, messageId: string, token: string) {
    await fetch(
        `https://graph.microsoft.com/v1.0/users/${mailbox}/messages/${messageId}`,
        {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ isRead: true }),
        }
    )
}

// ── NDR parsing ─────────────────────────────────────────────────────────────

/**
 * Extract the failed recipient from an NDR/bounce email body.
 * Office 365 NDRs use DSN format (RFC 3464) or plain text patterns.
 */
function extractBounceRecipient(body: string): string | null {
    // Final-Recipient header (RFC 3464 DSN format)
    const dsnMatch = body.match(/Final-Recipient:\s*rfc822;\s*([\w.+\-]+@[\w.\-]+)/i)
    if (dsnMatch) return dsnMatch[1].toLowerCase()

    // Original-Recipient header
    const origMatch = body.match(/Original-Recipient:\s*rfc822;\s*([\w.+\-]+@[\w.\-]+)/i)
    if (origMatch) return origMatch[1].toLowerCase()

    // O365 NDR pattern: "Delivery has failed to these recipients or groups:"
    const o365Match = body.match(/(?:delivery has failed|could not be delivered|undeliverable)[^<]*?<?([\w.+\-]+@[\w.\-]+)>?/i)
    if (o365Match) return o365Match[1].toLowerCase()

    // "failed permanently" / "not delivered to" patterns
    const failMatch = body.match(/(?:delivery to|failed permanently|could not be delivered to|undeliverable to)[:\s]+([\w.+\-]+@[\w.\-]+)/i)
    if (failMatch) return failMatch[1].toLowerCase()

    // Fallback: "To:" header in quoted original message
    const toMatch = body.match(/To:\s*<?([\\w.+\-]+@[\w.\-]+)>?/i)
    if (toMatch) return toMatch[1].toLowerCase()

    return null
}

/**
 * Strip HTML tags for text extraction from NDR body
 */
function stripHtml(html: string): string {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim()
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

    // ── Check Azure credentials ────────────────────────────────────────────
    if (!process.env.AZURE_TENANT_ID || !process.env.AZURE_CLIENT_ID || !process.env.AZURE_CLIENT_SECRET) {
        return NextResponse.json({
            status: 'inactive',
            message: 'Azure credentials not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET to activate Graph NDR polling.',
        })
    }

    try {
        const token = await getGraphAccessToken()
        const mailbox = getSenderMailbox()

        // Search for unread NDR messages in the sender's inbox
        // Office 365 NDRs come from: postmaster@*, mailer-daemon@*, or have specific subject prefixes
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        const filter = encodeURIComponent(
            `isRead eq false and receivedDateTime ge ${since} and (` +
            `startswith(subject,'Undeliverable:') or ` +
            `startswith(subject,'Delivery has failed') or ` +
            `startswith(subject,'Mail delivery failed') or ` +
            `startswith(subject,'Failure notice') or ` +
            `contains(from/emailAddress/address,'postmaster') or ` +
            `contains(from/emailAddress/address,'mailer-daemon')` +
            `)`
        )

        const url = `https://graph.microsoft.com/v1.0/users/${mailbox}/messages?$filter=${filter}&$top=50&$select=id,subject,isRead,receivedDateTime,body,from`

        const list = await graphGet<GraphMessageList>(url, token)
        const messages = list.value || []

        if (messages.length === 0) {
            return NextResponse.json({ status: 'ok', processed: 0, message: 'No new NDRs' })
        }

        let processedCount = 0
        let failedCount = 0

        for (const msg of messages) {
            try {
                // Extract body text — Graph returns HTML by default
                const bodyText = msg.body.contentType === 'html'
                    ? stripHtml(msg.body.content)
                    : msg.body.content

                const recipient = extractBounceRecipient(bodyText)

                if (!recipient) {
                    logger.warn('cron/graph-bounces', `Could not extract recipient from NDR: "${msg.subject}" (${msg.id})`)
                    await markAsRead(mailbox, msg.id, token)
                    continue
                }

                // Classify bounce from body content
                const category = classifyBounceError(bodyText)

                // Record in suppression engine + update EmailLog
                await recordBounce(recipient, category, `Graph NDR: ${bodyText.slice(0, 500)}`, 'mailer')

                // Write back to the most recent EmailLog for this recipient sent via graph
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
                          AND transport = 'graph'
                        ORDER BY "sentAt" DESC
                        LIMIT 1
                    )
                `, recipient, category, `Graph NDR processed at ${new Date().toISOString()}`.slice(0, 2000))

                // Mark NDR as read so we don't re-process it
                await markAsRead(mailbox, msg.id, token)

                logger.info('cron/graph-bounces', `Processed NDR for ${recipient} (${category}) — subject: "${msg.subject}"`)
                processedCount++
            } catch (err) {
                logger.error('cron/graph-bounces', `Failed to process NDR ${msg.id}`, { error: err as Error })
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
        logger.error('cron/graph-bounces', 'Graph NDR polling failed', { error: err as Error })
        return NextResponse.json({ error: 'Internal error', detail: String(err) }, { status: 500 })
    }
}
