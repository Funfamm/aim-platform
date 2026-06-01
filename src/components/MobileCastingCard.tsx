'use client'

import Image from 'next/image'
import { Link } from '@/i18n/navigation'
import { useLocale } from 'next-intl'
import { getLocalizedProject } from '@/lib/localize'

export interface CastingCallCardItem {
    id: string
    roleName: string
    roleType: string
    deadline: string | null
    project: {
        id: string
        title: string
        slug: string
        genre: string | null
        year: string | null
        coverImage: string | null
        translations: string | null
    }
    translations: string | null
}

interface Props {
    call: CastingCallCardItem
    /** True for the first card — eager-loads the image for LCP. */
    priority?: boolean
}

/**
 * Single casting-call card for the mobile hero carousel.
 * Background: project cover image.
 * Content: project title, role name, role type, deadline, Apply Now.
 * Apply Now → /casting (casting page where the user applies for the role).
 */
export default function MobileCastingCard({ call, priority = false }: Props) {
    const locale = useLocale()
    const loc = getLocalizedProject(call.project, locale)

    // Resolve localized role name from casting call's own translations JSON
    let roleName = call.roleName
    if (call.translations && locale !== 'en') {
        try {
            const tr = JSON.parse(call.translations) as Record<string, Record<string, string>>
            roleName = tr[locale]?.roleName || call.roleName
        } catch { /* keep original */ }
    }

    const coverImage = call.project.coverImage

    return (
        <>
            {/* Project cover image or dark fallback */}
            {coverImage ? (
                <Image
                    src={coverImage}
                    alt={loc.title}
                    fill
                    sizes="100vw"
                    priority={priority}
                    style={{ objectFit: 'cover', objectPosition: 'center top' }}
                />
            ) : (
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(135deg, #18101e, #0d0f14)',
                }} />
            )}

            {/* Cinematic gradient overlay */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(180deg, rgba(13,15,20,0.15) 0%, rgba(13,15,20,0.08) 30%, rgba(13,15,20,0.65) 60%, rgba(13,15,20,0.94) 82%, rgba(13,15,20,0.99) 100%)',
                pointerEvents: 'none',
            }} />

            {/* Top badge — "Casting Open" */}
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
                Casting Open
            </div>

            {/* Content — pinned to bottom */}
            <div style={{
                position: 'absolute',
                bottom: 0, left: 0, right: 0,
                padding: '0 20px 36px',
                zIndex: 2,
            }}>
                {/* Project title as eyebrow */}
                <span style={{
                    display: 'inline-block', marginBottom: '4px',
                    fontSize: '0.58rem', fontWeight: 700,
                    letterSpacing: '0.14em', textTransform: 'uppercase' as const,
                    color: 'var(--accent-gold)',
                }}>
                    {loc.title}
                </span>

                {/* Role name */}
                <h2 style={{
                    fontSize: 'clamp(1.3rem, 5vw, 1.8rem)',
                    fontWeight: 800, lineHeight: 1.15,
                    margin: '0 0 6px', color: '#ffffff',
                    textShadow: '0 2px 12px rgba(0,0,0,0.6)',
                }}>
                    {roleName}
                </h2>

                {/* Role type + deadline tags */}
                <div style={{
                    display: 'flex', gap: '7px', flexWrap: 'wrap' as const,
                    alignItems: 'center', marginBottom: '14px',
                }}>
                    {call.roleType && (
                        <span style={{
                            fontSize: '0.6rem', fontWeight: 600,
                            padding: '2px 8px', borderRadius: '99px',
                            background: 'rgba(212,168,83,0.1)',
                            border: '1px solid rgba(212,168,83,0.22)',
                            color: 'var(--accent-gold)',
                        }}>
                            {call.roleType}
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

                {/* Apply Now */}
                <Link
                    href="/casting"
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
                    Apply Now →
                </Link>
            </div>
        </>
    )
}
