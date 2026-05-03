import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// ── GET /api/notify-me/cta/[videoId] ────────────────────────────────────────
// Public endpoint: returns the active CTA configuration for a video.
// The player calls this on mount to decide whether to show an end-card.

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ videoId: string }> }
) {
    try {
        const { videoId } = await params

        if (!videoId) {
            return NextResponse.json({ cta: null })
        }

        // Find the active (or auto_disabled_post_release) CTA for this video
        const cta = await prisma.ctaConfiguration.findFirst({
            where: {
                videoId,
                status: { in: ['active', 'auto_disabled_post_release'] },
            },
        })

        if (!cta) {
            return NextResponse.json({ cta: null })
        }

        // Fetch the project for token substitution ([Film Name], [Year])
        const project = await prisma.project.findUnique({
            where: { id: videoId },
            select: { title: true, year: true, slug: true },
        })

        const filmName = project?.title || 'this film'
        const filmYear = project?.year || ''
        const filmSlug = project?.slug || ''

        // Token substitution helper
        const substitute = (text: string): string =>
            text
                .replace(/\[Film Name\]/gi, filmName)
                .replace(/\[Studio Name\]/gi, 'AIM Studio')
                .replace(/\[Year\]/gi, filmYear)

        // Determine if this is a post-release "Watch Now" state
        const isPostRelease = cta.status === 'auto_disabled_post_release'

        // Parse translations if present
        let translations: Record<string, Record<string, string>> | null = null
        if (cta.copyTranslations) {
            try {
                translations = JSON.parse(cta.copyTranslations)
            } catch {
                // Invalid JSON — ignore
            }
        }

        // Build the response
        const response = {
            cta: {
                id: cta.id,
                signupTag: cta.signupTag,
                notificationType: cta.notificationType,
                status: cta.status,
                isPostRelease,
                triggerSecondsFromEnd: cta.triggerSecondsFromEnd,
                // If post-release, serve the "Now Playing" copy
                endCard: isPostRelease
                    ? {
                        eyebrow: substitute(cta.releasedEyebrow),
                        headlineRegular: substitute(cta.releasedHeadline),
                        headlineItalic: '',
                        subtext: substitute(cta.releasedSubtext),
                        buttonLabel: substitute(cta.releasedButtonLabel),
                        footnote: '',
                    }
                    : {
                        eyebrow: substitute(cta.eyebrow),
                        headlineRegular: substitute(cta.headlineRegular),
                        headlineItalic: substitute(cta.headlineItalic),
                        subtext: substitute(cta.subtext),
                        buttonLabel: substitute(cta.buttonLabel),
                        footnote: substitute(cta.footnote),
                    },
                modal: isPostRelease
                    ? null
                    : {
                        headline: substitute(cta.modalHeadline),
                        subtext: substitute(cta.modalSubtext),
                        buttonLabel: substitute(cta.modalButtonLabel),
                        footnote: substitute(cta.modalFootnote),
                        privacyNote: substitute(cta.modalPrivacyNote),
                    },
                confirmation: isPostRelease
                    ? null
                    : {
                        headline: substitute(cta.confirmationHeadline),
                        subtext: substitute(cta.confirmationSubtext),
                        button: substitute(cta.confirmationButton),
                    },
                // Link for "Watch Now" post-release
                watchNowUrl: isPostRelease ? `/watch/${filmSlug}` : null,
                translations,
            },
        }

        return NextResponse.json(response)
    } catch (error) {
        console.error('[notify-me/cta] GET error:', error)
        return NextResponse.json({ cta: null }, { status: 500 })
    }
}
