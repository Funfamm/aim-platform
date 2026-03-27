'use client'

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
            <div style={{
                background: 'rgba(13, 15, 20, 0.65)',
                backdropFilter: 'blur(40px) saturate(1.3)',
                WebkitBackdropFilter: 'blur(40px) saturate(1.3)',
                border: '1px solid rgba(228, 185, 90, 0.12)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-md)',
                transition: 'all 0.3s ease',
                cursor: 'default',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--space-xs)',
                }}>
                    <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.08em',
                        color: 'var(--accent-gold)',
                        opacity: 0.8,
                    }}>{roleTypeLabel} {t('role')}</span>
                    <span className="badge badge-green" style={{ fontSize: '0.6rem', padding: '2px 8px' }}>{t('open')}</span>
                </div>

                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>
                    {roleName}
                </h4>

                <p style={{ fontSize: '0.78rem', lineHeight: 1.6, color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
                    {roleDescription.slice(0, 100)}{roleDescription.length > 100 ? '...' : ''}
                </p>

                <div style={{
                    display: 'flex',
                    gap: 'var(--space-sm)',
                    flexWrap: 'wrap',
                    marginBottom: 'var(--space-sm)',
                    fontSize: '0.7rem',
                    color: 'var(--text-tertiary)',
                }}>
                    {call.ageRange && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4" /><path d="M5.5 21a6.5 6.5 0 0113 0" /></svg>
                            {call.ageRange}
                        </span>
                    )}
                    {call.gender && (
                        <span>{call.gender}</span>
                    )}
                    {call.deadline && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                            {new Date(call.deadline).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                        </span>
                    )}
                </div>

                {/* Applicant count & spots */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: '0.7rem', color: 'var(--text-tertiary)',
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
                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                            {call.maxApplications - (call._count?.applications ?? 0)} {t('spotsLeft')}
                        </span>
                    )}
                </div>

                {hasApplied ? (
                    <div style={{
                        width: '100%',
                        padding: '0.5rem 1rem',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        border: '1px solid rgba(228, 185, 90, 0.4)',
                        borderRadius: 'var(--radius-full)',
                        color: 'var(--accent-gold)',
                        background: 'rgba(228, 185, 90, 0.08)',
                        cursor: 'not-allowed',
                        opacity: 0.85,
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                    }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Applied
                    </div>
                ) : (
                    <Link href={`/casting/${call.id}/apply`} className="btn btn-primary" style={{
                        width: '100%',
                        padding: '0.5rem 1rem',
                        fontSize: '0.8rem',
                    }}>
                        {t('apply')}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </Link>
                )}
            </div>
            {hasApplied && (applicationStatus === 'submitted' || applicationStatus === 'under_review') && (
                <button
                    className="btn btn-outline btn-warning"
                    style={{
                        width: '100%',
                        marginTop: '0.5rem',
                        padding: '0.5rem 1rem',
                        fontSize: '0.8rem',
                    }}
                    onClick={async () => {
                        const res = await fetch(`/api/casting/${call.id}/withdraw`, { method: 'POST' })
                        if (res.ok) {
                            // simple refresh to reflect change
                            window.location.reload()
                        } else {
                            const data = await res.json()
                            alert(data.error || 'Failed to withdraw')
                        }
                    }}
                >
                    {t('withdraw')}
                </button>
            )}
        </ScrollReveal3D>
    )
}
