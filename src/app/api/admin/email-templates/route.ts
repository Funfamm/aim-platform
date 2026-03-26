import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { invalidateTemplateOverrideCache } from '@/lib/email-templates'

const EDITABLE_KEYS = new Set([
    'welcome', 'subscribe', 'contact', 'donation', 'application',
    'statusUpdate', 'scriptSubmission', 'passwordChanged', 'newDeviceLogin',
])

export async function PUT(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const { templateKey, fields } = await req.json()

        if (!templateKey || !fields || typeof fields !== 'object') {
            return NextResponse.json({ error: 'templateKey and fields are required' }, { status: 400 })
        }
        if (!EDITABLE_KEYS.has(templateKey)) {
            return NextResponse.json({ error: 'This template cannot be edited' }, { status: 400 })
        }

        // Remove empty fields
        const cleaned: Record<string, string> = {}
        for (const [k, v] of Object.entries(fields)) {
            if (typeof v === 'string' && v.trim()) cleaned[k] = v.trim()
        }

        // Read current settings row
        const settings = await (prisma as any).siteSettings.findFirst()

        const overrides: Record<string, Record<string, string>> = (settings?.emailTemplateOverrides)
            ? JSON.parse(settings.emailTemplateOverrides as string)
            : {}

        if (Object.keys(cleaned).length > 0) {
            overrides[templateKey] = cleaned
        } else {
            delete overrides[templateKey]
        }

        const newValue = JSON.stringify(overrides)

        if (settings?.id) {
            await (prisma as any).siteSettings.update({
                where: { id: settings.id },
                data: { emailTemplateOverrides: newValue },
            })
        } else {
            await (prisma as any).siteSettings.create({
                data: { emailTemplateOverrides: newValue },
            })
        }

        invalidateTemplateOverrideCache()
        return NextResponse.json({ success: true, templateKey })
    } catch (err) {
        console.error('[email-templates PUT] Error:', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const { templateKey } = await req.json()
        if (!templateKey) {
            return NextResponse.json({ error: 'templateKey is required' }, { status: 400 })
        }

        const settings = await (prisma as any).siteSettings.findFirst()
        if (!settings?.id) return NextResponse.json({ success: true, templateKey })

        const overrides: Record<string, Record<string, string>> = settings.emailTemplateOverrides
            ? JSON.parse(settings.emailTemplateOverrides as string)
            : {}

        delete overrides[templateKey]

        await (prisma as any).siteSettings.update({
            where: { id: settings.id },
            data: { emailTemplateOverrides: JSON.stringify(overrides) },
        })

        invalidateTemplateOverrideCache()
        return NextResponse.json({ success: true, templateKey })
    } catch (err) {
        console.error('[email-templates DELETE] Error:', err)
        return NextResponse.json({ error: String(err) }, { status: 500 })
    }
}
