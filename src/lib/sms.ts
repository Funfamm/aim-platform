/**
 * AIM Studio – SMS Notification Service
 * ---------------------------------------------------------------------------
 * Architecture:
 *  - In MOCK mode (default / zero cost): logs messages to the console.
 *    No external service is called. Safe for development and staging.
 *
 *  - In PRODUCTION mode: drop-in Twilio integration.
 *    Set the following env vars to activate:
 *      ENABLE_SMS_NOTIFICATIONS=true
 *      TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *      TWILIO_AUTH_TOKEN=your_auth_token
 *      TWILIO_FROM_NUMBER=+1XXXXXXXXXX
 *
 * Usage:
 *   import { sendSMS } from '@/lib/sms'
 *   await sendSMS('+15551234567', 'Your application status changed!')
 */

const SMS_ENABLED = process.env.ENABLE_SMS_NOTIFICATIONS === 'true'
const TWILIO_SID   = process.env.TWILIO_ACCOUNT_SID
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM  = process.env.TWILIO_FROM_NUMBER

/**
 * Send an SMS to a phone number.
 * @param to      Recipient phone in E.164 format, e.g. +15551234567
 * @param message Text body (max 160 chars recommended for a single segment)
 * @returns       true if sent (or mock-sent), false on failure
 */
export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!to || !message) {
    console.warn('[SMS] sendSMS called with empty to/message – skipped.')
    return false
  }

  // ── PRODUCTION: real Twilio delivery ─────────────────────────────────────
  if (SMS_ENABLED && TWILIO_SID && TWILIO_TOKEN && TWILIO_FROM) {
    try {
      // Lazy-import twilio so it doesn't blow up in mock mode (package optional)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const twilio = require('twilio')
      const client = twilio(TWILIO_SID, TWILIO_TOKEN)
      await client.messages.create({
        body: message,
        from: TWILIO_FROM,
        to,
      })
      console.info(`[SMS] ✅ Sent to ${maskPhone(to)}`)
      return true
    } catch (err) {
      console.error(`[SMS] ❌ Twilio error for ${maskPhone(to)}:`, err)
      return false
    }
  }

  // ── MOCK: zero-cost console logging ──────────────────────────────────────
  console.log(
    `[Mock SMS]\n` +
    `  ┌─ To:      ${to}\n` +
    `  ├─ Message: ${message.slice(0, 80)}${message.length > 80 ? '…' : ''}\n` +
    `  └─ Status:  delivered (mock)\n`
  )
  return true
}

/**
 * Build a concise SMS body for a platform notification.
 * Keeps it under 160 chars to fit in a single SMS segment.
 */
export function buildSMSBody(title: string, message: string, link?: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const base = `AIM Studio: ${title}\n${message}`
  const suffix = link ? `\n${link.startsWith('http') ? link : `${siteUrl}${link}`}` : ''
  const full = base + suffix
  // Truncate body if over 155 chars to leave room for ellipsis
  return full.length <= 160 ? full : full.slice(0, 157) + '…'
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/** Mask phone number for safe logging, e.g. +155****4567 */
function maskPhone(phone: string): string {
  if (phone.length < 6) return '***'
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}
