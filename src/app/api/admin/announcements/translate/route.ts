import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { translateContent } from '@/lib/translate'

const ALL_LOCALES = ['fr', 'es', 'de', 'pt', 'hi', 'ko', 'zh', 'ru', 'ar', 'ja']

/**
 * POST /api/admin/announcements/translate
 * Admin-only: translates announcement title + message into all 10 non-English locales.
 *
 * Body:
 *   { title, message, link?, onlyLocales? }
 *
 * `onlyLocales` — optional subset of locales to (re-)translate.
 * Used for partial retries when some locales failed on the first attempt.
 *
 * Response:
 *   { translations: { [locale]: { title, message, ... } }, missing: string[] }
 *
 * `missing` — locales the AI did not return (AI hiccup, truncated JSON, etc.).
 * The client can re-call with those locales in `onlyLocales` to fill the gaps.
 */
export async function POST(req: NextRequest) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { title, message, link, onlyLocales } = body as {
        title?: string
        message?: string
        link?: string
        onlyLocales?: string[]
    }

    if (!title?.trim() || !message?.trim()) {
        return NextResponse.json({ error: 'title and message are required' }, { status: 400 })
    }

    // Which locales to translate this call
    const targetLocales = onlyLocales?.length
        ? ALL_LOCALES.filter(l => onlyLocales.includes(l))
        : ALL_LOCALES

    const translations = await translateContent(
        {
            title: title.trim(),
            message: message.trim(),
            badgeText: 'Platform Announcement',
            buttonText: link ? 'View Announcement →' : 'View in Notifications →',
            footerOptIn: "You're receiving this because you opted in to platform announcements.",
            managePrefs: 'Manage preferences',
        },
        'all',
        targetLocales,
    )

    if (!translations) {
        // Total failure — return which locales are missing so the client can retry all
        return NextResponse.json({
            error: 'Translation failed — please try again',
            translations: {},
            missing: targetLocales,
        }, { status: 500 })
    }

    // Partial success — figure out which locales the AI missed
    const missing = targetLocales.filter(l => !translations[l] || !translations[l].title)

    return NextResponse.json({ translations, missing })
}
