'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'
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
    auditState?: string | null
    adminRevealOverride?: boolean
}

// Statuses that are still withdrawable (before AI audition is complete)
const WITHDRAWABLE_STATUSES = ['submitted', 'under_review', 'pending']

// ── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(targetIso: string | null) {
    const [diff, setDiff] = useState<number>(targetIso ? Math.max(0, new Date(targetIso).getTime() - Date.now()) : 0)

    useEffect(() => {
        if (!targetIso) return
        const tick = () => setDiff(Math.max(0, new Date(targetIso).getTime() - Date.now()))
        tick()
        const id = setInterval(tick, 1000)
        return () => clearInterval(id)
    }, [targetIso])

    const days    = Math.floor(diff / 86400000)
    const hours   = Math.floor((diff % 86400000) / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    const expired = diff === 0

    return { days, hours, minutes, seconds, expired }
}

// ── Countdown Display ─────────────────────────────────────────────────────────
function CountdownDisplay({ targetIso, t }: { targetIso: string; t: ReturnType<typeof useTranslations> }) {
    const { days, hours, minutes, seconds, expired } = useCountdown(targetIso)
    const locale = useLocale()

    if (expired) {
        return (
            <div style={{
                marginTop: '12px',
                padding: '10px 16px',
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.3)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'center',
                color: 'var(--color-success)',
                fontSize: '0.85rem',
                fontWeight: 700,
            }}>
                {t('resultCountdownExpired')}
            </div>
        )
    }

    const revealDate = new Date(targetIso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })

    const units = [
        { value: days,    label: t('resultDays',    { days })    },
        { value: hours,   label: t('resultHours',   { hours })   },
        { value: minutes, label: t('resultMinutes', { min: minutes }) },
        { value: seconds, label: t('resultSeconds', { sec: seconds }) },
    ].filter((u, i) => i > 0 || u.value > 0) // hide leading zero days

    return (
        <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: '8px' }}>
                {t('resultCountdownLabel')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                {units.map(({ value, label }) => (
                    <div key={label} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        minWidth: '52px',
                        padding: '8px 6px',
                        background: 'rgba(228,185,90,0.07)',
                        border: '1px solid rgba(228,185,90,0.18)',
                        borderRadius: 'var(--radius-md)',
                    }}>
                        <span style={{
                            fontSize: '1.4rem', fontWeight: 800, lineHeight: 1,
                            color: 'var(--accent-gold)',
                            fontVariantNumeric: 'tabular-nums',
                        }}>
                            {String(value).padStart(2, '0')}
                        </span>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: '3px', letterSpacing: '0.04em' }}>
                            {label}
                        </span>
                    </div>
                ))}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: '8px' }}>
                {t('resultAvailableOn', { date: revealDate })}
            </div>
        </div>
    )
}

// ── Audit state banner ────────────────────────────────────────────────────────
function AuditStateBanner({ auditState, resultVisibleAt, adminRevealOverride, t }: {
    auditState: string | null | undefined
    resultVisibleAt: string | null
    adminRevealOverride: boolean
    t: ReturnType<typeof useTranslations>
}) {
    const locale = useLocale()

    // If admin forced reveal or result is actually visible, show nothing extra
    if (adminRevealOverride || auditState === 'scored_visible') return null
    // Legacy: no auditState set yet — fall back to resultVisibleAt logic
    if (!auditState) {
        if (!resultVisibleAt || new Date(resultVisibleAt) <= new Date()) return null
        return (
            <div style={{
                marginTop: 'var(--space-md)',
                padding: '0.85rem 1rem',
                background: 'rgba(228,185,90,0.06)',
                border: '1px solid rgba(228,185,90,0.15)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem', color: 'var(--text-secondary)',
                lineHeight: 1.5, textAlign: 'center',
            }}>
                {t('resultPending')}
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    {t('resultAvailableOn', {
                        date: new Date(resultVisibleAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }),
                    })}
                </div>
            </div>
        )
    }

    const stateConfig: Record<string, { icon: string; color: string; bg: string; border: string; key: string }> = {
        queued: {
            icon: '🕐',
            color: 'var(--color-info)',
            bg: 'rgba(59,130,246,0.07)',
            border: 'rgba(59,130,246,0.2)',
            key: 'auditQueued',
        },
        processing: {
            icon: '🤖',
            color: 'var(--color-warning)',
            bg: 'rgba(245,158,11,0.08)',
            border: 'rgba(245,158,11,0.25)',
            key: 'auditProcessing',
        },
        scored_hidden: {
            icon: '⏳',
            color: 'var(--accent-gold)',
            bg: 'rgba(228,185,90,0.06)',
            border: 'rgba(228,185,90,0.2)',
            key: 'auditScoredHidden',
        },
        failed: {
            icon: '⚠️',
            color: 'var(--color-error)',
            bg: 'rgba(239,68,68,0.07)',
            border: 'rgba(239,68,68,0.2)',
            key: 'auditFailed',
        },
    }

    const cfg = stateConfig[auditState]
    if (!cfg) return null

    const revealDateFmt = resultVisibleAt
        ? new Date(resultVisibleAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
        : ''

    const message = cfg.key === 'auditScoredHidden'
        ? t('auditScoredHidden', { date: revealDateFmt })
        : t(cfg.key as any)

    return (
        <div style={{
            marginTop: 'var(--space-md)',
            padding: '0.9rem 1.1rem',
            background: cfg.bg,
            border: `1px solid ${cfg.border}`,
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '4px' }}>{cfg.icon}</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: cfg.color, lineHeight: 1.5 }}>
                {message}
            </div>
            {auditState === 'scored_hidden' && resultVisibleAt && (
                <CountdownDisplay targetIso={resultVisibleAt} t={t} />
            )}
            {(auditState === 'queued' || auditState === 'processing') && (
                <div style={{
                    marginTop: '8px',
                    display: 'flex', justifyContent: 'center', gap: '4px', alignItems: 'center',
                }}>
                    {[0, 1, 2].map(i => (
                        <div key={i} style={{
                            width: '5px', height: '5px', borderRadius: '50%',
                            background: cfg.color,
                            opacity: 0.3,
                            animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                        }} />
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Main component ────────────────────────────────────────────────────────────
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
    const label  = t(statusKeyMap[application.status] ?? 'statusSubmitted' as any)

    // Determine if result is currently visible
    const isVisible = application.adminRevealOverride
        || application.auditState === 'scored_visible'
        || (!!application.resultVisibleAt && new Date(application.resultVisibleAt) <= new Date())

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
            <div className="glass-panel" style={{
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

                {/* Audit queue state banner with countdown */}
                <AuditStateBanner
                    auditState={application.auditState}
                    resultVisibleAt={application.resultVisibleAt}
                    adminRevealOverride={application.adminRevealOverride ?? false}
                    t={t}
                />

                {/* Revealed statusNote — only shown once result is visible */}
                {isVisible && application.statusNote && (
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
            <div className="glass-panel" style={{
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
