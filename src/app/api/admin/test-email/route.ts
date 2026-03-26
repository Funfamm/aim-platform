import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { sendTestEmail } from '@/lib/mailer'

export async function POST(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const { to } = await req.json()
        if (!to) return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 })

        await sendTestEmail(to)
        return NextResponse.json({ success: true, message: `Test email sent to ${to}` })
    } catch (err) {
        return NextResponse.json({ error: String(err instanceof Error ? err.message : err) }, { status: 500 })
    }
}
