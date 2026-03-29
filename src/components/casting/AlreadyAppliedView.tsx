'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'

interface ApplicationInfo {
    id: string
    fullName: string
    email: string
    phone: string | null
    age: number | null
    gender: string | null
    location: string | null
    specialSkills: string | null
    status: string
    statusNote: string | null
    resultVisibleAt: string | null
    createdAt: string
    castingCallId: string
    roleName: string
    projectTitle: string
    projectSlug: string
}

// Statuses that are still withdrawable (before AI audition is complete)
const WITHDRAWABLE_STATUSES = ['submitted', 'under_review', 'pending']

export default function AlreadyAppliedView({ application }: { application: ApplicationInfo }) {
    const router = useRouter()
    const t = useTranslations('alreadyApplied')
    const locale = useLocale()
    const [withdrawing, setWithdrawing] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const canWithdraw = WITHDRAWABLE_STATUSES.includes(application.status)
    const canReapply  = application.status === 'withdrawn'

    const statusKeyMap: Record<string, string> = {
        submitted:    'statusSubmitted',
        under_review: 'statusUnderReview',
        shortlisted:  'statusShortlisted',
        callback:     'statusCallback',
        final_review: 'statusFinalReview',
        selected:     'statusSelected',
        not_selected: 'statusNotSelected',
        withdrawn:    'statusWithdrawn',
    }
    const statusColorMap: Record<string, { color: string; bg: string; icon: string }> = {
        submitted:    { color: 'var(--color-info)',    bg: 'rgba(59,130,246,0.12)',  icon: '📩' },
        under_review: { color: 'var(--color-warning)', bg: 'rgba(245,158,11,0.12)', icon: '🔍' },
        shortlisted:  { color: 'var(--color-success)', bg: 'rgba(16,185,129,0.12)',  icon: '⭐' },
        callback:     { color: '#8b5cf6',              bg: 'rgba(139,92,246,0.12)',  icon: '📞' },
        final_review: { color: '#f97316',              bg: 'rgba(249,115,22,0.12)',  icon: '🎯' },
        selected:     { color: 'var(--color-success)', bg: 'rgba(34,197,94,0.15)',   icon: '✅' },
        not_selected: { color: 'var(--color-muted)',   bg: 'rgba(107,114,128,0.12)', icon: '💭' },
        withdrawn:    { color: '#9ca3af',              bg: 'rgba(156,163,175,0.1)',  icon: '↩️' },
    }
    const meta   = statusColorMap[application.status] ?? statusColorMap['submitted']
    const label  = t(statusKeyMap[application.status] ?? 'statusSubmitted')

    async function handleWithdraw() {
        if (!confirm(t('withdrawConfirm'))) return
        setWithdrawing(true)
        setError(null)
        try {
            const res = await fetch(`/api/casting/${application.castingCallId}/withdraw`, { method: 'POST' })
            if (res.ok) {
                router.refresh()
            } else {
                const data = await res.json()
                setError(data.error || t('withdrawError'))
            }
        } catch {
            setError(t('networkError'))
        } finally {
            setWithdrawing(false)
        }
    }

    const appliedDate = new Date(application.createdAt).toLocaleDateString(locale, {
        year: 'numeric', month: 'long', day: 'numeric',
    })

    const fields = [
        { label: t('fieldName'),      value: application.fullName },
        { label: t('fieldEmail'),     value: application.email },
        { label: t('fieldPhone'),     value: application.phone },
        { label: t('fieldAge'),       value: application.age != null ? String(application.age) : null },
        { label: t('fieldGender'),    value: application.gender },
        { label: t('fieldLocation'),  value: application.location },
        { label: t('fieldSkills'),    value: application.specialSkills },
        { label: t('fieldAppliedOn'), value: appliedDate },
    ]

    return (
        <div style={{
            maxWidth: '720px', margin: '0 auto',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)',
        }}>
            {/* ── Banner ── */}
            <div style={{
                background: 'rgba(13,15,20,0.75)',
                border: '1px solid rgba(228,185,90,0.18)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-xl)',
                textAlign: 'center',
                backdropFilter: 'blur(32px)',
            }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎭</div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
                    {t('banner')}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '420px', margin: '0 auto', lineHeight: 1.6 }}>
                    {t('bannerDesc')
                        .replace('{role}', application.roleName)
                        .replace('{project}', application.projectTitle)}
                </p>

                {/* Status badge */}
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    margin: 'var(--space-md) auto 0',
                    padding: '0.45rem 1.2rem',
                    background: meta.bg,
                    border: `1px solid ${meta.color}40`,
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.85rem', fontWeight: 700, color: meta.color,
                    letterSpacing: '0.02em',
                }}>
                    {meta.icon} {label}
                </div>

                {/* Pending reveal state */}
                {!application.statusNote && application.resultVisibleAt && new Date(application.resultVisibleAt) > new Date() && (
                    <div style={{
                        marginTop: 'var(--space-md)',
                        padding: '0.85rem 1rem',
                        background: 'rgba(228,185,90,0.06)',
                        border: '1px solid rgba(228,185,90,0.15)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.85rem', color: 'var(--text-secondary)',
                        lineHeight: 1.5, textAlign: 'center',
                    }}>
                        ⏳ {t('resultPending')}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                            {t('resultAvailableOn', { date: new Date(application.resultVisibleAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) })}
                        </div>
                    </div>
                )}

                {/* Revealed statusNote */}
                {application.statusNote && (
                    <div style={{
                        marginTop: 'var(--space-md)',
                        padding: '0.75rem 1rem',
                        background: 'rgba(228,185,90,0.06)',
                        borderLeft: '2px solid var(--accent-gold)',
                        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                        fontSize: '0.85rem', color: 'var(--text-secondary)',
                        fontStyle: 'italic', lineHeight: 1.5,
                        textAlign: 'left', maxWidth: '480px', margin: 'var(--space-md) auto 0',
                    }}>
                        {application.statusNote}
                    </div>
                )}
            </div>

            {/* ── Submitted Info ── */}
            <div style={{
                background: 'rgba(13,15,20,0.65)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 'var(--radius-xl)',
                padding: 'var(--space-xl)',
                backdropFilter: 'blur(24px)',
            }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 'var(--space-md)' }}>
                    {t('submittedInfo')}
                </h3>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: 'var(--space-sm)',
                }}>
                    {fields.map(({ label: l, value: v }) => v ? (
                        <div key={l} style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.6rem 0.9rem',
                        }}>
                            <div style={{ fontSize: '0.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                                {l}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                                {v}
                            </div>
                        </div>
                    ) : null)}
                </div>
            </div>

            {/* ── Actions ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                {canWithdraw && (
                    <>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
                            {t('withdrawNote')}
                        </p>
                        {error && (
                            <div style={{ padding: '0.6rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', color: 'var(--color-error)', fontSize: '0.82rem', textAlign: 'center' }}>
                                {error}
                            </div>
                        )}
                        <button
                            onClick={handleWithdraw}
                            disabled={withdrawing}
                            style={{
                                width: '100%', padding: '0.7rem 1rem', fontSize: '0.85rem', fontWeight: 700,
                                background: withdrawing ? 'rgba(239,68,68,0.05)' : 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: 'var(--radius-full)',
                                color: 'var(--color-error)', cursor: withdrawing ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s', opacity: withdrawing ? 0.6 : 1,
                            }}
                        >
                            {withdrawing ? t('withdrawing') : t('withdrawBtn')}
                        </button>
                    </>
                )}

                {canReapply && (
                    <>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
                            {t('reapplyNote')}
                        </p>
                        <Link
                            href={`/casting/${application.castingCallId}/apply?reapply=1`}
                            className="btn btn-primary"
                            style={{ width: '100%', textAlign: 'center', padding: '0.7rem 1rem', fontSize: '0.85rem' }}
                        >
                            {t('reapplyBtn')}
                        </Link>
                    </>
                )}

                <Link
                    href="/casting#roles"
                    style={{
                        display: 'block', width: '100%', textAlign: 'center',
                        padding: '0.6rem 1rem', fontSize: '0.82rem',
                        color: 'var(--text-tertiary)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 'var(--radius-full)',
                        textDecoration: 'none',
                        transition: 'all 0.2s',
                    }}
                >
                    {t('backToRoles')}
                </Link>
            </div>
        </div>
    )
}
