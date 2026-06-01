'use client'

import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { useLocale } from 'next-intl'
import { usePathname } from '@/i18n/navigation'
import { defaultLocale } from '@/i18n/routing'

export interface ScriptCallCardItem {
    id: string
    title: string
    description: string
    genre: string | null
    targetLength: string | null
    deadline: string | null
    project: {
        title: string
        coverImage: string | null
        translations: string | null
    } | null
    _count: { submissions: number }
}

interface Props {
    call: ScriptCallCardItem
    isLoggedIn: boolean
    /** True for the first card — eager-loads the image for LCP. */
    priority?: boolean
}

/**
 * Single script-call card for the mobile hero carousel.
 * Background: project cover image (or dark fallback).
 * Content: script title, genre, deadline, Submit Script button.
 * Guests → locale-aware login redirect preserving the script detail page as return path.
 * Logged-in → direct link to /scripts/[id].
 */
export default function MobileScriptCard({ call, isLoggedIn, priority = false }: Props) {
    const locale = useLocale()
    const pathname = usePathname() // locale-stripped, e.g. '/scripts'

    // Build locale-prefixed path for the redirect parameter so the user returns
    // to the correct locale page after logging in.
    const scriptDetailPath = `/scripts/${call.id}`
    const localePrefixedDetail =
        locale === defaultLocale ? scriptDetailPath : `/${locale}${scriptDetailPath}`

    const ctaHref = isLoggedIn
        ? scriptDetailPath
        : `/login?redirect=${encodeURIComponent(localePrefixedDetail)}`

    const coverImage = call.project?.coverImage ?? null

    // Resolve project title with locale
    let projectTitle = call.project?.title ?? null
    if (call.project?.translations && locale !== 'en') {
        try {
            const tr = JSON.parse(call.project.translations) as Record<string, Record<string, string>>
            projectTitle = tr[locale]?.title ?? projectTitle
        } catch { /* keep original */ }
    }

    return (
        <>
            {/* Project cover image or dark fallback */}
            {coverImage ? (
                <Image
                    src={coverImage}
                    alt={call.title}
                    fill
                    sizes="100vw"
                    priority={priority}
                    style={{ objectFit: 'cover', objectPosition: 'center top' }}
                />
            ) : (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(135deg, #0f1420, #0d0f14)',
                }} />
            )}

            {/* Cinematic gradient overlay */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(13,15,20,0.1) 0%, rgba(13,15,20,0.06) 28%, rgba(13,15,20,0.62) 58%, rgba(13,15,20,0.94) 80%, rgba(13,15,20,0.99) 100%)',
                pointerEvents: 'none',
            }} />

            {/* Top badge — "Script Submissions Open" */}
            <div style={{
                position: 'absolute',
                top: '16px', left: '20px',
                zIndex: 2,
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                fontSize: '0.55rem', fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase' as const,
                color: 'var(--accent-gold)',
                background: 'rgba(212,168,83,0.1)',
                border: '1px solid rgba(212,168,83,0.25)',
                padding: '3px 10px', borderRadius: '99px',
                backdropFilter: 'blur(8px)',
            }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-gold)', display: 'inline-block' }} />
                Scripts Open
            </div>

            {/* Content — pinned to bottom */}
            <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                padding: '0 20px 36px',
                zIndex: 2,
            }}>
                {/* Project eyebrow */}
                {projectTitle && (
                    <span style={{
                        display: 'inline-block', marginBottom: '4px',
                        fontSize: '0.58rem', fontWeight: 700,
                        letterSpacing: '0.14em', textTransform: 'uppercase' as const,
                        color: 'var(--accent-gold)',
                    }}>
                        {projectTitle}
                    </span>
                )}

                {/* Script call title */}
                <h2 style={{
                    fontSize: 'clamp(1.3rem, 5vw, 1.8rem)',
                    fontWeight: 800, lineHeight: 1.15,
                    margin: '0 0 6px', color: '#ffffff',
                    textShadow: '0 2px 12px rgba(0,0,0,0.6)',
                }}>
                    {call.title}
                </h2>

                {/* Tags — genre, length, deadline */}
                <div style={{
                    display: 'flex', gap: '6px', flexWrap: 'wrap' as const,
                    alignItems: 'center', marginBottom: '14px',
                }}>
                    {call.genre && (
                        <span style={{
                            fontSize: '0.6rem', fontWeight: 600,
                            padding: '2px 8px', borderRadius: '99px',
                            background: 'rgba(212,168,83,0.1)',
                            border: '1px solid rgba(212,168,83,0.22)',
                            color: 'var(--accent-gold)',
                        }}>
                            {call.genre}
                        </span>
                    )}
                    {call.targetLength && (
                        <span style={{
                            fontSize: '0.6rem', fontWeight: 600,
                            padding: '2px 8px', borderRadius: '99px',
                            background: 'rgba(96,165,250,0.1)',
                            border: '1px solid rgba(96,165,250,0.22)',
                            color: '#60a5fa',
                        }}>
                            {call.targetLength}
                        </span>
                    )}
                    {call.deadline && (
                        <span style={{
                            fontSize: '0.6rem', color: 'rgba(255,255,255,0.52)',
                        }}>
                            ⏰ {call.deadline}
                        </span>
                    )}
                </div>

                {/* CTA — Submit Script (logged-in) or Login to Submit (guest) */}
                <Link
                    href={ctaHref}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px',
                        fontSize: '0.8rem', fontWeight: 700,
                        padding: '0.5rem 1.1rem',
                        borderRadius: '99px',
                        textDecoration: 'none',
                        background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                        color: '#0f1115',
                    }}
                >
                    {isLoggedIn ? 'Submit Script →' : 'Login to Submit →'}
                </Link>
            </div>
        </>
    )
}
