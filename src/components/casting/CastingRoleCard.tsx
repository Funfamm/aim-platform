'use client'

import { useState } from 'react'
import Link from 'next/link'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import { useTranslations, useLocale } from 'next-intl'

interface CastingCall {
    id: string
    roleName: string
    roleType: string
    roleDescription: string
    ageRange: string | null
    gender: string | null
    deadline: string | null
    compensation: string | null
    requirements: string
    translations: string | null
    project: {
        id: string
        title: string
        slug: string
        genre: string | null
        year: string | null
        coverImage: string | null
    }
    _count?: {
        applications: number
    }
    maxApplications?: number
}

interface Props {
    call: CastingCall
    index: number
    hasApplied?: boolean
    applicationStatus?: string
}

export default function CastingRoleCard({ call, index, hasApplied = false, applicationStatus }: Props) {
    const t = useTranslations('castingCard')
    const locale = useLocale()

    // Local state so withdrawal/reapply updates UI instantly without page reload
    const [localStatus, setLocalStatus] = useState<string | undefined>(applicationStatus)
    const [localApplied, setLocalApplied] = useState(hasApplied)
    // After reapply, don't show Withdraw again (one reapply = done)
    const [reapplied, setReapplied] = useState(false)

    const isWithdrawn = localStatus === 'withdrawn'
    const showApplyBtn = !localApplied || isWithdrawn
    const showWithdraw = localApplied && !isWithdrawn && !reapplied
        && (localStatus === 'submitted' || localStatus === 'under_review')

    const roleTypeKeys: Record<string, string> = { lead: 'roleTypeLead', supporting: 'roleTypeSupporting', extra: 'roleTypeExtra' }
    const roleTypeLabel = t(roleTypeKeys[call.roleType.toLowerCase()] || 'roleTypeLead')

    // Parse translations for current locale
    const tr = (() => {
        if (locale === 'en' || !call.translations) return null
        try { return JSON.parse(call.translations)?.[locale] || null } catch { return null }
    })()
    const roleName = tr?.roleName || call.roleName
    const roleDescription = tr?.roleDescription || call.roleDescription
    return (
        <ScrollReveal3D direction="up" delay={index * 80} distance={30}>
            {/* Outer shell — shape, border, shadow only. No filter to avoid blocking backdrop-filter. */}
            <div style={{
                position: 'relative',
                borderRadius: '20px',
                border: '1px solid rgba(255, 255, 255, 0.42)',
                boxShadow: [
                    '0 10px 35px rgba(0, 0, 0, 0.10)',
                    'inset 0 1px 0 rgba(255, 255, 255, 0.60)',
                    'inset 0 -10px 22px rgba(255, 255, 255, 0.12)',
                    'inset 4px 0 12px rgba(255, 255, 255, 0.06)',
                    'inset -4px 0 12px rgba(255, 255, 255, 0.06)',
                ].join(', '),
                animation: 'glowPulse 4s ease-in-out infinite',
                overflow: 'hidden',
            }}>
                {/* Frost + white-leather surface layer */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backdropFilter: 'blur(44px) saturate(180%) brightness(1.08)',
                    WebkitBackdropFilter: 'blur(44px) saturate(180%) brightness(1.08)',
                    background: [
                        'linear-gradient(170deg, rgba(255,255,255,0.46) 0%, rgba(255,255,255,0.30) 100%)',
                        'rgba(255, 255, 255, 0.24)',
                    ].join(', '),
                    borderRadius: 'inherit',
                    zIndex: 0,
                    pointerEvents: 'none',
                }} />
                {/* Content layer */}
                <div style={{
                    position: 'relative',
                    zIndex: 1,
                    padding: 'var(--space-md)',
                    transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
                }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--space-xs)',
                }}>
                    <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        fontFamily: 'var(--font-display)',
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.1em',
                        color: '#b8882a',
                    }}>{roleTypeLabel} {t('role')}</span>
                    <span className="badge badge-green" style={{ fontSize: '0.6rem', padding: '2px 8px' }}>{t('open')}</span>
                </div>

                <h4 style={{
                    fontSize: '1.05rem', fontWeight: 800,
                    fontFamily: 'var(--font-display)',
                    marginBottom: 'var(--space-xs)',
                    color: '#1a1a2e',
                    letterSpacing: '-0.01em',
                }}>
                    {roleName}
                </h4>

                <p style={{
                    fontSize: '0.78rem', lineHeight: 1.6,
                    color: 'rgba(30,30,50,0.72)',
                    marginBottom: 'var(--space-sm)',
                }}>
                    {roleDescription.slice(0, 100)}{roleDescription.length > 100 ? '...' : ''}
                </p>

                <div style={{
                    display: 'flex',
                    gap: '5px',
                    flexWrap: 'wrap',
                    marginBottom: 'var(--space-sm)',
                }}>
                    {call.ageRange && (
                        <span style={{
                            fontSize: '0.6rem', padding: '2px 9px', fontWeight: 600,
                            background: 'rgba(184,136,42,0.10)', color: '#b8882a',
                            borderRadius: '5px', border: '1px solid rgba(184,136,42,0.22)',
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                        }}>
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="7" r="4" /><path d="M5.5 21a6.5 6.5 0 0113 0" /></svg>
                            {call.ageRange}
                        </span>
                    )}
                    {call.gender && (
                        <span style={{
                            fontSize: '0.6rem', padding: '2px 9px', fontWeight: 600,
                            background: 'rgba(184,136,42,0.10)', color: '#b8882a',
                            borderRadius: '5px', border: '1px solid rgba(184,136,42,0.22)',
                        }}>{call.gender}</span>
                    )}

                    {call.deadline && (
                        <span style={{
                            fontSize: '0.6rem', padding: '2px 9px',
                            background: 'rgba(30,30,50,0.06)', color: 'rgba(30,30,50,0.55)',
                            borderRadius: '5px', border: '1px solid rgba(30,30,50,0.10)',
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                        }}>
                            ⏰ {new Date(call.deadline).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                        </span>
                    )}
                </div>

                {/* Applicant count & spots */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: '0.7rem', color: 'rgba(30,30,50,0.50)',
                    marginBottom: 'var(--space-sm)',
                    padding: '4px 0',
                }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{(call._count?.applications ?? 0) >= 10 ? '🔥' : (call._count?.applications ?? 0) > 0 ? '👥' : '🆕'}</span>
                        <span>
                            {(call._count?.applications ?? 0) === 0
                                ? t('beFirst')
                                : `${call._count?.applications} ${(call._count?.applications ?? 0) === 1 ? t('applicant') : t('applicants')}`}
                        </span>
                    </span>
                    {call.maxApplications && (call.maxApplications - (call._count?.applications ?? 0)) <= 10 && (call.maxApplications - (call._count?.applications ?? 0)) > 0 && (
                        <span style={{ color: '#c97c2a', fontWeight: 600 }}>
                            {call.maxApplications - (call._count?.applications ?? 0)} {t('spotsLeft')}
                        </span>
                    )}
                </div>

                {/* ── CTA area — state-driven ── */}
                {localApplied && !isWithdrawn ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Applied badge — clickable, goes to application status page */}
                        <Link
                            href={`/casting/${call.id}/apply`}
                            style={{
                                width: '100%', padding: '0.5rem 1rem', fontSize: '0.8rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                border: '1px solid rgba(228,185,90,0.4)', borderRadius: 'var(--radius-full)',
                                color: 'var(--accent-gold)', background: 'rgba(228,185,90,0.08)',
                                cursor: 'pointer', opacity: 0.9, fontWeight: 600, letterSpacing: '0.02em',
                                textDecoration: 'none', transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(228,185,90,0.15)'
                                ;(e.currentTarget as HTMLAnchorElement).style.opacity = '1'
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(228,185,90,0.08)'
                                ;(e.currentTarget as HTMLAnchorElement).style.opacity = '0.9'
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {t('applied')}
                        </Link>

                        {/* Withdraw — only for submitted / under_review, and not after a reapply */}
                        {showWithdraw && (
                            <button
                                style={{
                                    width: '100%', padding: '0.4rem 1rem', fontSize: '0.73rem',
                                    fontWeight: 600, letterSpacing: '0.02em', borderRadius: 'var(--radius-full)',
                                    border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)',
                                    color: 'rgba(239,68,68,0.75)', cursor: 'pointer', transition: 'all 0.2s ease',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.12)'
                                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.45)'
                                    ;(e.currentTarget as HTMLButtonElement).style.color = 'rgb(239,68,68)'
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.06)'
                                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(239,68,68,0.25)'
                                    ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(239,68,68,0.75)'
                                }}
                                onClick={async () => {
                                    const res = await fetch(`/api/casting/${call.id}/withdraw`, { method: 'POST' })
                                    if (res.ok) {
                                        setLocalStatus('withdrawn')
                                        setLocalApplied(false)
                                    } else {
                                        const data = await res.json()
                                        alert(data.error || 'Failed to withdraw')
                                    }
                                }}
                            >
                                {t('withdraw')}
                            </button>
                        )}
                    </div>
                ) : (
                    /* Apply / Re-apply button — solid gold gradient */
                    <Link
                        href={`/casting/${call.id}/apply`}
                        style={{
                            display: 'block', width: '100%', padding: '0.65rem 1rem',
                            fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.03em', textAlign: 'center',
                            borderRadius: 'var(--radius-full)', textDecoration: 'none',
                            border: 'none',
                            background: isWithdrawn
                                ? 'linear-gradient(135deg, rgba(228,185,90,0.15), rgba(228,185,90,0.08))'
                                : 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold), var(--accent-gold-dark))',
                            color: isWithdrawn ? 'var(--accent-gold)' : '#0f1115',
                            transition: 'all 0.3s ease',
                            boxShadow: isWithdrawn ? 'none' : '0 4px 16px rgba(228,185,90,0.3)',
                        }}
                        onMouseEnter={e => {
                            if (!isWithdrawn) {
                                (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 6px 28px rgba(228,185,90,0.5)'
                                ;(e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)'
                                ;(e.currentTarget as HTMLAnchorElement).style.filter = 'brightness(1.08)'
                            }
                        }}
                        onMouseLeave={e => {
                            if (!isWithdrawn) {
                                (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 16px rgba(228,185,90,0.3)'
                                ;(e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(0)'
                                ;(e.currentTarget as HTMLAnchorElement).style.filter = 'none'
                            }
                        }}
                        onClick={() => {
                            if (isWithdrawn) {
                                setReapplied(true)
                                setLocalApplied(true)
                                setLocalStatus('submitted')
                            }
                        }}
                    >
                        {isWithdrawn ? '↩ ' + t('applyAgain') : t('apply')}
                    </Link>
                )}
                </div>
            </div>
        </ScrollReveal3D>
    )
}
