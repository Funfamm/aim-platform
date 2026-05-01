import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { translateContent } from '@/lib/translate'
import { requireAdmin } from '@/lib/auth'

const VALID_SCOPES = ['home', 'works', 'upcoming', 'about', 'footer', 'joinCta'] as const

/**
 * GET /api/admin/translation-review?scope=home
 * 
 * Returns all ContentTranslation rows for a given scope, with status.
 */
export async function GET(req: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const scope = req.nextUrl.searchParams.get('scope')
        if (!scope || !VALID_SCOPES.includes(scope as (typeof VALID_SCOPES)[number])) {
            return NextResponse.json({ error: 'Missing or invalid scope parameter' }, { status: 400 })
        }

        const translations = await prisma.contentTranslation.findMany({
            where: { scope },
            orderBy: { locale: 'asc' },
        })

        // Parse content JSON for each translation
        const result = translations.map(t => ({
            id: t.id,
            scope: t.scope,
            locale: t.locale,
            content: (() => { try { return JSON.parse(t.content) } catch { return {} } })(),
            status: t.status,
            sourceVersion: t.sourceVersion,
            reviewedBy: t.reviewedBy,
            reviewedAt: t.reviewedAt,
            updatedAt: t.updatedAt,
        }))

        return NextResponse.json(result)

    } catch (err) {
        console.error('[translation-review] GET error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * PUT /api/admin/translation-review
 * 
 * Admin approves or edits a specific locale translation.
 * Body: { scope, locale, content?: object, status: "approved" | "pending_review" }
 */
export async function PUT(req: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const body = await req.json()
        const { scope, locale, content, status } = body

        if (!scope || !locale) {
            return NextResponse.json({ error: 'scope and locale are required' }, { status: 400 })
        }

        if (!VALID_SCOPES.includes(scope)) {
            return NextResponse.json({ error: 'Invalid scope' }, { status: 400 })
        }

        if (status && !['approved', 'pending_review'].includes(status)) {
            return NextResponse.json({ error: 'Status must be "approved" or "pending_review"' }, { status: 400 })
        }

        const existing = await prisma.contentTranslation.findUnique({
            where: { scope_locale: { scope, locale } },
        })

        if (!existing) {
            return NextResponse.json({ error: `No translation found for scope=${scope}, locale=${locale}` }, { status: 404 })
        }

        const updateData: Record<string, unknown> = {}

        // If content is provided, update the translation text
        if (content && typeof content === 'object') {
            updateData.content = JSON.stringify(content)
        }

        // If status is set to approved
        if (status === 'approved') {
            updateData.status = 'approved'
            updateData.reviewedAt = new Date()
            updateData.reviewedBy = 'admin' // In a full implementation, use the admin session ID
        } else if (status) {
            updateData.status = status
        }

        const updated = await prisma.contentTranslation.update({
            where: { scope_locale: { scope, locale } },
            data: updateData,
        })

        return NextResponse.json({
            message: `Translation for ${locale} (${scope}) updated`,
            status: updated.status,
            updatedAt: updated.updatedAt,
        })

    } catch (err) {
        console.error('[translation-review] PUT error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * POST /api/admin/translation-review
 * 
 * Bulk approve all locales for a scope, or re-generate a single locale.
 * Body: { scope, action: "approve_all" | "regenerate", locale?: string, instructions?: string }
 */
export async function POST(req: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const body = await req.json()
        const { scope, action, locale, instructions } = body

        if (!scope || !VALID_SCOPES.includes(scope)) {
            return NextResponse.json({ error: 'Invalid scope' }, { status: 400 })
        }

        if (action === 'approve_all') {
            // Bulk approve all pending/stale translations for this scope
            const result = await prisma.contentTranslation.updateMany({
                where: {
                    scope,
                    locale: { not: 'en' },
                    status: { in: ['pending_review', 'stale'] },
                },
                data: {
                    status: 'approved',
                    reviewedAt: new Date(),
                    reviewedBy: 'admin',
                },
            })

            return NextResponse.json({
                message: `Approved ${result.count} translation(s) for ${scope}`,
                approved: result.count,
            })
        }

        if (action === 'regenerate' && locale) {
            // Re-generate translation for a single locale
            const enSnapshot = await prisma.contentTranslation.findUnique({
                where: { scope_locale: { scope, locale: 'en' } },
            })

            if (!enSnapshot) {
                return NextResponse.json({ error: 'No English snapshot found. Generate translations first.' }, { status: 404 })
            }

            let fields: Record<string, string> = {}
            try { fields = JSON.parse(enSnapshot.content) } catch { /* */ }

            const customPrompt = instructions
                ? `Additional instructions from the admin: ${instructions}\n\n`
                : ''

            const result = await translateContent(
                fields,
                'all',
                [locale], // only translate this locale
            )

            if (!result || !result[locale]) {
                return NextResponse.json({ error: 'Re-generation failed' }, { status: 500 })
            }

            await prisma.contentTranslation.upsert({
                where: { scope_locale: { scope, locale } },
                create: {
                    scope,
                    locale,
                    content: JSON.stringify(result[locale]),
                    sourceVersion: enSnapshot.sourceVersion,
                    status: 'pending_review',
                },
                update: {
                    content: JSON.stringify(result[locale]),
                    status: 'pending_review',
                },
            })

            return NextResponse.json({
                message: `Re-generated translation for ${locale} (${scope})`,
                content: result[locale],
            })
        }

        return NextResponse.json({ error: 'Invalid action. Use "approve_all" or "regenerate"' }, { status: 400 })

    } catch (err) {
        console.error('[translation-review] POST error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
