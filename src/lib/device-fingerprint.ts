import { prisma } from '@/lib/db'
import { newDeviceLoginEmail } from '@/lib/email-templates'
import { sendEmail } from '@/lib/mailer'
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

  // Load current known devices (JSON string → array)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { knownDevices: true, lastLoginAt: true } as any,
  }) as any
  const known: string[] = user?.knownDevices ? JSON.parse(user.knownDevices) : []

  // Rate‑limit: only one email per 24 h
  const now = new Date()
  const lastLogin = user?.lastLoginAt
  const shouldNotify =
    !known.includes(fingerprint) &&
    (!lastLogin || now.getTime() - new Date(lastLogin).getTime() > 24 * 60 * 60 * 1000)

  // Build a single update payload
  const updateData: Record<string, unknown> = { lastLoginAt: now }

  if (shouldNotify) {
    const settings = await getCachedSettings()
    if (settings && (settings as any).notifyOnNewDevice) {
      void sendEmail({
        to: userEmail,
        subject: 'New device login detected on your account',
        html: newDeviceLoginEmail(userName, { ip, ua }, process.env.NEXT_PUBLIC_SITE_URL),
      }).catch(() => {})
    }
    const updated = [fingerprint, ...known].slice(0, 10)
    updateData.knownDevices = JSON.stringify(updated)
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData as any,
  })
}
