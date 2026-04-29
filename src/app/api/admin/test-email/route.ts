import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { sendTestEmail } from '@/lib/mailer'
import { testAcsConnection } from '@/lib/acs-email'
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/secure'

/**
 * POST /api/admin/test-email
 *
 * Body: { to: string, transport?: 'graph' | 'acs' }
 *
 * transport = 'graph' (default) → sends via Microsoft Graph (existing behavior)
 * transport = 'acs'             → sends via Azure Communication Services
 */
export async function POST(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const { to, transport } = await req.json()
        if (!to) return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 })

        // ── ACS test path ──────────────────────────────────────────────────
        if (transport === 'acs') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const settings = await (prisma.siteSettings as any).findFirst({
                select: { acsConnectionString: true, acsSenderAddress: true },
            })

            if (!settings?.acsConnectionString) {
                return NextResponse.json({
                    error: 'ACS Connection String is not configured. Go to Admin → Settings → Bulk Transport and enter your Azure Communication Services connection string.',
                }, { status: 400 })
            }

            if (!settings?.acsSenderAddress) {
                return NextResponse.json({
                    error: 'ACS Sender Address is not configured. Go to Admin → Settings → Bulk Transport and enter a verified sender address (e.g. DoNotReply@mail.impactaistudio.com).',
                }, { status: 400 })
            }

            const connectionString = decrypt(settings.acsConnectionString)

            await testAcsConnection(
                { connectionString, senderAddress: settings.acsSenderAddress },
                to,
            )

            return NextResponse.json({
                success: true,
                transport: 'acs',
                sender: settings.acsSenderAddress,
                message: `✅ ACS test email sent to ${to} from ${settings.acsSenderAddress}`,
            })
        }

        // ── Graph test path (default) ──────────────────────────────────────
        await sendTestEmail(to)
        return NextResponse.json({
            success: true,
            transport: 'graph',
            message: `Test email sent to ${to} via Microsoft Graph`,
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
