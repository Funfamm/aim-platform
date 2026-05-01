import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { translateContent } from '@/lib/translate'
import { requireAdmin } from '@/lib/auth'

const VALID_SCOPES = ['home', 'works', 'upcoming', 'about', 'footer', 'joinCta'] as const
type Scope = (typeof VALID_SCOPES)[number]

// Map scope → SiteSettings JSON field name
const SCOPE_FIELD: Record<Scope, string> = {
    home: 'homePageData',
    works: 'worksPageData',
    upcoming: 'upcomingPageData',
    about: 'aboutPageData',
    footer: 'footerPageData',
    joinCta: 'joinCtaData',
}

/**
 * POST /api/admin/translate-page
 * 
 * Diff-based translation: only re-translates fields that changed since the
 * last time translations were generated. Unchanged fields keep their existing
 * translations untouched.
 */
export async function POST(req: NextRequest) {
    try {
        await requireAdmin()
    } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
        const body = await req.json()
        const scope = body.scope as Scope

        if (!VALID_SCOPES.includes(scope)) {
            return NextResponse.json({ error: `Invalid scope. Must be one of: ${VALID_SCOPES.join(', ')}` }, { status: 400 })
        }

        // 1. Read the current English content from SiteSettings
        const settings = await prisma.siteSettings.findFirst()
        if (!settings) {
            return NextResponse.json({ error: 'Site settings not found' }, { status: 404 })
        }

        const fieldName = SCOPE_FIELD[scope]
        const rawJson = (settings as Record<string, unknown>)[fieldName] as string | null
        let currentContent: Record<string, string> = {}
        try {
            if (rawJson) currentContent = JSON.parse(rawJson)
        } catch { /* */ }

        // Filter to string-only fields (skip arrays, numbers, etc.)
        const currentFields: Record<string, string> = {}
        for (const [k, v] of Object.entries(currentContent)) {
            if (typeof v === 'string' && v.trim()) {
                currentFields[k] = v
            }
        }

        if (Object.keys(currentFields).length === 0) {
            return NextResponse.json({ message: 'No content to translate — all fields are empty', translated: 0 })
        }

        // 2. Read the previous English snapshot from ContentTranslation
        const enSnapshot = await prisma.contentTranslation.findUnique({
            where: { scope_locale: { scope, locale: 'en' } },
        })

        let previousFields: Record<string, string> = {}
        try {
            if (enSnapshot?.content) previousFields = JSON.parse(enSnapshot.content)
        } catch { /* */ }

        // 3. Diff: identify only fields that actually changed
        const changedFields: Record<string, string> = {}
        for (const [key, value] of Object.entries(currentFields)) {
            if (previousFields[key] !== value) {
                changedFields[key] = value
            }
        }

        if (Object.keys(changedFields).length === 0) {
            return NextResponse.json({ message: 'No fields changed since last translation', translated: 0 })
        }

        // 4. Translate only changed fields
        const contextHint = `Page section: ${scope}. Brand: AIM Studio (AI cinema studio). Tone: cinematic, emotional, literary. Keep "AIM Studio" untranslated. Translate "Don't look away" by sense, flag for admin review.`
        
        const translations = await translateContent(
            changedFields,
            'all', // use all available API keys
        )

        if (!translations) {
            return NextResponse.json({ error: 'Translation failed — no API keys available or AI error' }, { status: 500 })
        }

        // 5. Save English snapshot for future diffs
        const newVersion = (enSnapshot?.sourceVersion ?? 0) + 1
        await prisma.contentTranslation.upsert({
            where: { scope_locale: { scope, locale: 'en' } },
            create: {
                scope,
                locale: 'en',
                content: JSON.stringify(currentFields),
                sourceVersion: newVersion,
                status: 'published',
            },
            update: {
                content: JSON.stringify(currentFields),
                sourceVersion: newVersion,
                status: 'published',
            },
        })

        // 6. Merge new translations into existing, preserving unchanged fields
        const localeStatuses: Record<string, string> = {}
        const changedKeys = Object.keys(changedFields)

        for (const [locale, translatedFields] of Object.entries(translations)) {
            const existing = await prisma.contentTranslation.findUnique({
                where: { scope_locale: { scope, locale } },
            })

            let merged: Record<string, string> = {}
            try {
                if (existing?.content) merged = JSON.parse(existing.content)
            } catch { /* */ }

            // Merge: overwrite only changed fields
            for (const key of changedKeys) {
                if (translatedFields[key]) {
                    merged[key] = translatedFields[key]
                }
            }

            await prisma.contentTranslation.upsert({
                where: { scope_locale: { scope, locale } },
                create: {
                    scope,
                    locale,
                    content: JSON.stringify(merged),
                    sourceVersion: newVersion,
                    status: 'pending_review',
                },
                update: {
                    content: JSON.stringify(merged),
                    sourceVersion: newVersion,
                    status: existing?.status === 'approved' ? 'stale' : 'pending_review',
                },
            })

            localeStatuses[locale] = existing?.status === 'approved' ? 'stale' : 'pending_review'
        }

        return NextResponse.json({
            message: `Translated ${changedKeys.length} changed field(s) across ${Object.keys(translations).length} locale(s)`,
            translated: changedKeys.length,
            changedFields: changedKeys,
            locales: localeStatuses,
        })

    } catch (err) {
        console.error('[translate-page] Error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
