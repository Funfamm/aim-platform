import { prisma } from '@/lib/db'
import { newDeviceLoginEmailLocalized } from '@/lib/email-templates'
import { t as emailT } from '@/lib/email-i18n'
import { sendTransactionalEmail } from '@/lib/email-router'
import crypto from 'crypto'
import { getCachedSettings } from '@/lib/cached-settings'

/**
 * Handles device‑fingerprint detection and optional security‑email notification.
 * Called from every login entry point after the user has been authenticated.
 */
export async function handleDeviceFingerprint(
  request: Request,
  userId: string,
  userName: string,
  userEmail: string,
  tokenVersion: number
): Promise<void> {
  // Build fingerprint – hash of user‑agent + IP (no raw data stored)
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? ''
  const ua = request.headers.get('user-agent') ?? ''
  const fingerprint = crypto.createHash('sha256').update(ua + ip).digest('hex')

  // Load current known devices (JSON string → array) and creation timestamp
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { knownDevices: true, lastLoginAt: true, createdAt: true, preferredLanguage: true } as any,
  }) as any
  const known: string[] = user?.knownDevices ? JSON.parse(user.knownDevices) : []
  const userLocale: string = user?.preferredLanguage || 'en'

  // Detect first login (no known devices and no prior login timestamp)
  const isFirstLogin = known.length === 0 && !user?.lastLoginAt

  // Rate‑limit: only one email per 24 h, and skip if this is the first login
  const now = new Date()
  const lastLogin = user?.lastLoginAt
  const ONE_DAY_MS = 24 * 60 * 60 * 1000
  const shouldNotify =
    !isFirstLogin &&
    !known.includes(fingerprint) &&
    (!lastLogin || now.getTime() - new Date(lastLogin).getTime() > ONE_DAY_MS)

  // Build a single update payload (always record fingerprint)
  const updateData: Record<string, unknown> = { lastLoginAt: now }

  // If we should notify, send the email (admin toggle respected)
  if (shouldNotify) {
    const settings = await getCachedSettings()
    if (settings && (settings as any).notifyOnNewDevice) {
      void newDeviceLoginEmailLocalized(userName, { ip, ua }, process.env.NEXT_PUBLIC_SITE_URL, userLocale)
        .then(html => sendTransactionalEmail({
            to: userEmail,
            subject: emailT('securityNewDevice', userLocale, 'subject') || 'New device login detected on your account',
            html,
        }))
        .catch(() => {})
    }
  }

  // Always update known devices (including first login)
  const updated = [fingerprint, ...known].slice(0, 10)
  updateData.knownDevices = JSON.stringify(updated)

  await prisma.user.update({
    where: { id: userId },
    data: updateData as any,
  })
}
