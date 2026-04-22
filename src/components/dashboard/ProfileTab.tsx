'use client'

import { useState, useEffect, FormEvent } from 'react'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import { useTranslations } from 'next-intl'

interface ProfileTabProps {
    user: {
        name: string
        email: string
        bannerUrl: string | null
        role: string
        hasPassword?: boolean
        authProvider?: 'google' | 'apple' | 'credentials'
        accentColor?: string
    }
    refreshUser: () => Promise<void>
    hasCastingCalls?: boolean
}

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg-primary)',
    border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none',
}

const cardStyle: React.CSSProperties = {
    background: 'var(--bg-glass-light)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-xl)', padding: 'var(--space-lg)',
}

const sectionTitle: React.CSSProperties = {
    fontSize: '0.85rem', fontWeight: 700, marginBottom: '4px',
}

const sectionDesc: React.CSSProperties = {
    color: 'var(--text-tertiary)', fontSize: '0.75rem', marginBottom: 'var(--space-md)',
}

const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.72rem', fontWeight: 600,
    color: 'var(--text-secondary)', marginBottom: '4px',
}

// ── Accent colour definitions ──────────────────────────────
const ACCENT_KEY = 'aim-accent'

const ACCENTS = [
    {
        key: 'gold',
        i18nKey: 'colorGold',
        base: '#e4b95a',
        light: '#f5dfa0',
        dark: '#b8922e',
        glow: 'rgba(228,185,90,0.15)',
        glowStrong: 'rgba(228,185,90,0.25)',
        lift: '0 8px 30px rgba(228,185,90,0.25),0 2px 8px rgba(228,185,90,0.15)',
    },
    {
        key: 'silver',
        i18nKey: 'colorSilver',
        base: '#c8c8d4',
        light: '#e8e8f0',
        dark: '#8888a0',
        glow: 'rgba(200,200,212,0.15)',
        glowStrong: 'rgba(200,200,212,0.25)',
        lift: '0 8px 30px rgba(200,200,212,0.25),0 2px 8px rgba(200,200,212,0.15)',
    },
    {
        key: 'ember',
        i18nKey: 'colorEmber',
        base: '#f06b47',
        light: '#f9a88e',
        dark: '#b84820',
        glow: 'rgba(240,107,71,0.15)',
        glowStrong: 'rgba(240,107,71,0.25)',
        lift: '0 8px 30px rgba(240,107,71,0.25),0 2px 8px rgba(240,107,71,0.15)',
    },
    {
        key: 'jade',
        i18nKey: 'colorJade',
        base: '#34d399',
        light: '#6ee7b7',
        dark: '#059669',
        glow: 'rgba(52,211,153,0.15)',
        glowStrong: 'rgba(52,211,153,0.25)',
        lift: '0 8px 30px rgba(52,211,153,0.25),0 2px 8px rgba(52,211,153,0.15)',
    },
    {
        key: 'azure',
        i18nKey: 'colorAzure',
        base: '#60a5fa',
        light: '#93c5fd',
        dark: '#2563eb',
        glow: 'rgba(96,165,250,0.15)',
        glowStrong: 'rgba(96,165,250,0.25)',
        lift: '0 8px 30px rgba(96,165,250,0.25),0 2px 8px rgba(96,165,250,0.15)',
    },
    {
        key: 'rose',
        i18nKey: 'colorRose',
        base: '#f472b6',
        light: '#f9a8d4',
        dark: '#db2777',
        glow: 'rgba(244,114,182,0.15)',
        glowStrong: 'rgba(244,114,182,0.25)',
        lift: '0 8px 30px rgba(244,114,182,0.25),0 2px 8px rgba(244,114,182,0.15)',
    },
    {
        key: 'violet',
        i18nKey: 'colorViolet',
        base: '#a78bfa',
        light: '#c4b5fd',
        dark: '#7c3aed',
        glow: 'rgba(167,139,250,0.15)',
        glowStrong: 'rgba(167,139,250,0.25)',
        lift: '0 8px 30px rgba(167,139,250,0.25),0 2px 8px rgba(167,139,250,0.15)',
    },
    {
        key: 'copper',
        i18nKey: 'colorCopper',
        base: '#d4956a',
        light: '#e8b896',
        dark: '#a0623a',
        glow: 'rgba(212,149,106,0.15)',
        glowStrong: 'rgba(212,149,106,0.25)',
        lift: '0 8px 30px rgba(212,149,106,0.25),0 2px 8px rgba(212,149,106,0.15)',
    },
    {
        key: 'platinum',
        i18nKey: 'colorPlatinum',
        base: '#e2e8f0',
        light: '#f1f5f9',
        dark: '#94a3b8',
        glow: 'rgba(226,232,240,0.15)',
        glowStrong: 'rgba(226,232,240,0.25)',
        lift: '0 8px 30px rgba(226,232,240,0.25),0 2px 8px rgba(226,232,240,0.15)',
    },
    {
        key: 'crimson',
        i18nKey: 'colorCrimson',
        base: '#ef4444',
        light: '#f87171',
        dark: '#b91c1c',
        glow: 'rgba(239,68,68,0.15)',
        glowStrong: 'rgba(239,68,68,0.25)',
        lift: '0 8px 30px rgba(239,68,68,0.25),0 2px 8px rgba(239,68,68,0.15)',
    },
] as const

type AccentKey = typeof ACCENTS[number]['key']

function applyAccent(key: AccentKey) {
    const accent = ACCENTS.find(a => a.key === key)!
    requestAnimationFrame(() => {
        const r = document.documentElement
        r.style.setProperty('--accent-gold',       accent.base)
        r.style.setProperty('--accent-gold-light',  accent.light)
        r.style.setProperty('--accent-gold-dark',   accent.dark)
        r.style.setProperty('--accent-gold-glow',   accent.glow)
        r.style.setProperty('--accent-cream',       accent.dark)
        r.style.setProperty('--text-accent',        accent.base)
        r.style.setProperty('--border-accent',      `${accent.base}55`)
        r.style.setProperty('--border-glow',        `${accent.base}80`)
        r.style.setProperty('--shadow-glow',        `0 0 40px ${accent.glow}`)
        r.style.setProperty('--shadow-glow-strong', `0 0 80px ${accent.glowStrong}`)
        r.style.setProperty('--shadow-gold-lift',   accent.lift)
    })
}

// Persisted notification keys
const NOTIF_KEYS = {
    appUpdates: 'aim-notif-app-updates',
    castingAlerts: 'aim-notif-casting-alerts',
    donationReceipts: 'aim-notif-donation-receipts',
} as const

function readBool(key: string, fallback: boolean): boolean {
    if (typeof window === 'undefined') return fallback
    const v = localStorage.getItem(key)
    if (v === null) return fallback
    return v === 'true'
}

export default function ProfileTab({ user, refreshUser, hasCastingCalls }: ProfileTabProps) {
    const t = useTranslations('profileTab')
    const [profileName, setProfileName] = useState(user.name)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [profileStatus, setProfileStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [profileError, setProfileError] = useState('')
    const [bannerUploading, setBannerUploading] = useState(false)

    // OAuth set-password flow state
    const [setPassStep, setSetPassStep] = useState<'idle' | 'sending' | 'code-sent' | 'setting' | 'done'>('idle')
    const [setPassCode, setSetPassCode] = useState('')
    const [setPassNew, setSetPassNew] = useState('')
    const [setPassConfirm, setSetPassConfirm] = useState('')
    const [setPassError, setSetPassError] = useState('')
    const [setPassMsg, setSetPassMsg] = useState('')

    const isOAuthOnly = !user.hasPassword && (user.authProvider === 'google' || user.authProvider === 'apple')
    const providerLabel = user.authProvider === 'google' ? 'Google' : user.authProvider === 'apple' ? 'Apple' : ''

    // Accent colour — persisted to DB (server) + localStorage (instant/fallback)
    const [accentKey, setAccentKey] = useState<AccentKey>(() => {
        // Server value takes priority
        if (user.accentColor && ACCENTS.some(a => a.key === user.accentColor)) return user.accentColor as AccentKey
        if (typeof window === 'undefined') return 'gold'
        return (localStorage.getItem(ACCENT_KEY) as AccentKey) ?? 'gold'
    })
    useEffect(() => { applyAccent(accentKey) }, [accentKey])

    function handleAccent(key: AccentKey) {
        setAccentKey(key)
        localStorage.setItem(ACCENT_KEY, key)
        applyAccent(key)
        // Persist to server (fire-and-forget)
        fetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accentColor: key }),
        }).catch(() => { /* silent */ })
    }

    // Notifications — persisted in localStorage
    const [notifAppUpdates, setNotifAppUpdates] = useState(() => readBool(NOTIF_KEYS.appUpdates, true))
    const [notifCastingAlerts, setNotifCastingAlerts] = useState(() => readBool(NOTIF_KEYS.castingAlerts, true))
    const [notifDonationReceipts, setNotifDonationReceipts] = useState(() => readBool(NOTIF_KEYS.donationReceipts, true))

    function toggleNotif(key: keyof typeof NOTIF_KEYS, current: boolean, setter: (v: boolean) => void) {
        const next = !current
        setter(next)
        localStorage.setItem(NOTIF_KEYS[key], String(next))
    }

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setBannerUploading(true)
        try {
            const formData = new FormData()
            formData.append('banner', file)
            const res = await fetch('/api/auth/banner', { method: 'POST', body: formData })
            if (res.ok) { await refreshUser() }
            else { const data = await res.json(); alert(data.error || t('uploadFailed')) }
        } catch { alert(t('uploadFailedRetry')) }
        setBannerUploading(false)
        e.target.value = ''
    }

    const handleRemoveBanner = async () => {
        if (!confirm(t('removeBannerConfirm'))) return
        await fetch('/api/auth/banner', { method: 'DELETE' })
        await refreshUser()
    }

    // Map API error codes to i18n keys
    const errorCodeToI18n: Record<string, string> = {
        ERR_CURRENT_REQUIRED: 'errCurrentRequired',
        ERR_PW_TOO_SHORT: 'minCharsError',
        ERR_OAUTH_NO_PASSWORD: 'errOauthNoPassword',
        ERR_CURRENT_INCORRECT: 'errCurrentIncorrect',
        ERR_SAME_PASSWORD: 'errSamePassword',
        ERR_REUSED_PASSWORD: 'errReusedPassword',
    }

    const handleProfileUpdate = async (e: FormEvent) => {
        e.preventDefault()
        setProfileError('')
        setProfileStatus('saving')
        if (newPassword && newPassword !== confirmNewPassword) {
            setProfileError(t('passwordsNoMatch'))
            setProfileStatus('error')
            return
        }
        try {
            const body: { name?: string; currentPassword?: string; newPassword?: string } = {}
            if (profileName !== user.name) body.name = profileName
            if (newPassword) { body.currentPassword = currentPassword; body.newPassword = newPassword }
            if (Object.keys(body).length === 0) { setProfileStatus('idle'); return }
            const res = await fetch('/api/auth/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
            const data = await res.json()
            if (res.ok) {
                setProfileStatus('saved'); setCurrentPassword(''); setNewPassword(''); setConfirmNewPassword('')
                await refreshUser()
                setTimeout(() => setProfileStatus('idle'), 3000)
            } else {
                const i18nKey = errorCodeToI18n[data.error]
                setProfileError(i18nKey ? t(i18nKey) : (data.error || t('updateFailed')))
                setProfileStatus('error')
            }
        } catch { setProfileError(t('networkError')); setProfileStatus('error') }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <style>{`
                .profile-grid-2col {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: var(--space-md);
                }
                @media (max-width: 640px) {
                    .profile-grid-2col {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>

            {/* ────── ROW 1: Profile Summary + Banner (side by side) ────── */}
            <ScrollReveal3D direction="up" delay={80} distance={15}>
                <div className="profile-grid-2col">
                    {/* Profile Avatar Card */}
                    <div style={{
                        ...cardStyle,
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', textAlign: 'center', position: 'relative', overflow: 'hidden',
                    }}>
                        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '140px', height: '140px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
                        <div style={{
                            width: '52px', height: '52px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold-dark))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.3rem', fontWeight: 800, color: 'var(--bg-primary)',
                            boxShadow: '0 0 0 3px rgba(212,168,83,0.2)',
                            marginBottom: '8px',
                        }}>{user.name.charAt(0).toUpperCase()}</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '2px' }}>{user.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: '8px' }}>{user.email}</div>
                        <span style={{
                            padding: '3px 10px', fontSize: '0.62rem', fontWeight: 700,
                            borderRadius: '20px', letterSpacing: '0.04em',
                            background: user.role === 'admin' ? 'rgba(212,168,83,0.15)' : 'rgba(255,255,255,0.06)',
                            color: user.role === 'admin' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                            border: `1px solid ${user.role === 'admin' ? 'rgba(212,168,83,0.2)' : 'var(--border-subtle)'}`,
                        }}>{user.role === 'admin' ? `👑 ${t('admin')}` : `🎭 ${t('member')}`}</span>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {[
                                ...(hasCastingCalls ? [{ href: '/casting', label: `🎬 ${t('exploreCasting')}` }] : []),
                                { href: '/works', label: `🎥 ${t('browseWorks')}` },
                                { href: '/donate', label: `💛 ${t('supportUs')}` },
                            ].map((link) => (
                                <a key={link.href} href={link.href} style={{
                                    padding: '4px 10px', fontSize: '0.65rem', fontWeight: 600,
                                    borderRadius: '16px', textDecoration: 'none',
                                    background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)',
                                    border: '1px solid var(--border-subtle)', transition: 'all 0.2s',
                                }}>{link.label}</a>
                            ))}
                        </div>
                    </div>

                    {/* Banner Card */}
                    <div style={cardStyle}>
                        <h3 style={sectionTitle}>🖼️ {t('profileBanner')}</h3>
                        <p style={sectionDesc}>{t('bannerDesc')}</p>
                        <div style={{
                            position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden',
                            height: '90px', marginBottom: '10px',
                            background: user.bannerUrl
                                ? `url(${user.bannerUrl}) center/cover`
                                : 'linear-gradient(135deg, rgba(212,168,83,0.08), rgba(30,30,40,0.8), rgba(212,168,83,0.05))',
                            border: '1px solid var(--border-subtle)',
                        }}>
                            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 30%, rgba(0,0,0,0.5) 100%)' }} />
                            <div style={{ position: 'absolute', bottom: '8px', left: '10px', zIndex: 1, fontSize: '0.6rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                {user.bannerUrl ? t('currentBanner') : t('noBannerSet')}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <label style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                padding: '0.4rem 0.9rem', fontSize: '0.72rem', fontWeight: 600,
                                background: 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold-dark))',
                                color: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)',
                                cursor: bannerUploading ? 'wait' : 'pointer',
                                opacity: bannerUploading ? 0.6 : 1,
                            }}>
                                {bannerUploading ? `⏳ ${t('uploading')}` : `📷 ${t('uploadBanner')}`}
                                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={handleBannerUpload} disabled={bannerUploading} />
                            </label>
                            {user.bannerUrl && (
                                <button onClick={handleRemoveBanner} style={{
                                    padding: '0.4rem 0.8rem', fontSize: '0.72rem', fontWeight: 600,
                                    background: 'rgba(239,68,68,0.12)', color: 'var(--color-error)',
                                    border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)',
                                    cursor: 'pointer',
                                }}>✕ {t('remove')}</button>
                            )}
                            <span style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{t('fileTypes')}</span>
                        </div>
                    </div>
                </div>
            </ScrollReveal3D>

            {/* ────── ROW 2: Personal Info + Security (side by side) ────── */}
            <ScrollReveal3D direction="up" delay={150} distance={15}>
                <div className="profile-grid-2col">
                    {/* Personal Info */}
                    <div style={cardStyle}>
                        <h3 style={sectionTitle}>✏️ {t('personalInfo')}</h3>
                        <p style={sectionDesc}>{t('personalInfoDesc')}</p>
                        {profileStatus === 'saved' && (
                            <div style={{ padding: '6px 10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: '10px', fontSize: '0.75rem', color: 'var(--color-success)' }}>✓ {t('profileUpdated')}</div>
                        )}
                        {profileError && (
                            <div style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: '10px', fontSize: '0.75rem', color: 'var(--color-error)' }}>{profileError}</div>
                        )}
                        <form onSubmit={handleProfileUpdate}>
                            <div style={{ marginBottom: '10px' }}>
                                <label style={labelStyle}>{t('email')}</label>
                                <div style={{ ...inputStyle, background: 'rgba(255,255,255,0.03)', color: 'var(--text-tertiary)' }}>{user.email}</div>
                            </div>
                            <div style={{ marginBottom: '12px' }}>
                                <label style={labelStyle}>{t('fullName')}</label>
                                <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} required style={inputStyle} />
                            </div>
                            <button type="submit" disabled={profileStatus === 'saving'} className="btn btn-primary" style={{ padding: '0.5rem 1.4rem', fontSize: '0.78rem', fontWeight: 700, opacity: profileStatus === 'saving' ? 0.7 : 1 }}>
                                {profileStatus === 'saving' ? t('saving') : t('saveChanges')}
                            </button>
                        </form>
                    </div>

                    {/* Security */}
                    <div style={cardStyle}>
                        <h3 style={sectionTitle}>🔒 {t('security')}</h3>

                        {isOAuthOnly ? (
                            /* ── OAuth-only user: Set Password flow ─────────── */
                            <>
                                {/* Info notice */}
                                <div style={{
                                    padding: '12px 14px',
                                    background: 'rgba(96,165,250,0.08)',
                                    border: '1px solid rgba(96,165,250,0.2)',
                                    borderRadius: 'var(--radius-md)',
                                    marginBottom: 'var(--space-md)',
                                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                                }}>
                                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>ℹ️</span>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        {t('oauthNoPassword', { provider: providerLabel })}
                                    </div>
                                </div>

                                {setPassStep === 'done' ? (
                                    <div style={{ padding: '10px 14px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--color-success)' }}>
                                        ✅ {t('passwordSetSuccess')}
                                    </div>
                                ) : (
                                    <>
                                        {setPassError && (
                                            <div style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: '10px', fontSize: '0.75rem', color: 'var(--color-error)' }}>{setPassError}</div>
                                        )}
                                        {setPassMsg && (
                                            <div style={{ padding: '6px 10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: '10px', fontSize: '0.75rem', color: 'var(--color-success)' }}>{setPassMsg}</div>
                                        )}

                                        {setPassStep === 'idle' || setPassStep === 'sending' ? (
                                            <button
                                                className="btn btn-primary"
                                                disabled={setPassStep === 'sending'}
                                                style={{ padding: '0.5rem 1.4rem', fontSize: '0.78rem', fontWeight: 700, opacity: setPassStep === 'sending' ? 0.7 : 1 }}
                                                onClick={async () => {
                                                    setSetPassStep('sending')
                                                    setSetPassError('')
                                                    setSetPassMsg('')
                                                    try {
                                                        const res = await fetch('/api/auth/set-password', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ action: 'send-code' }),
                                                        })
                                                        const data = await res.json()
                                                        if (res.ok) {
                                                            setSetPassStep('code-sent')
                                                            setSetPassMsg(t('codeSentToEmail'))
                                                        } else {
                                                            setSetPassError(data.error || t('networkError'))
                                                            setSetPassStep('idle')
                                                        }
                                                    } catch {
                                                        setSetPassError(t('networkError'))
                                                        setSetPassStep('idle')
                                                    }
                                                }}
                                            >
                                                {setPassStep === 'sending' ? t('saving') : t('createPasswordBtn')}
                                            </button>
                                        ) : (
                                            /* Code entry + new password form */
                                            <form onSubmit={async (e) => {
                                                e.preventDefault()
                                                setSetPassError('')
                                                if (setPassNew.length < 6) { setSetPassError(t('minCharsError')); return }
                                                if (setPassNew !== setPassConfirm) { setSetPassError(t('passwordsNoMatch')); return }
                                                setSetPassStep('setting')
                                                try {
                                                    const res = await fetch('/api/auth/set-password', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ action: 'set', code: setPassCode, newPassword: setPassNew }),
                                                    })
                                                    const data = await res.json()
                                                    if (res.ok) {
                                                        setSetPassStep('done')
                                                        await refreshUser()
                                                    } else {
                                                        setSetPassError(data.error || t('updateFailed'))
                                                        setSetPassStep('code-sent')
                                                    }
                                                } catch {
                                                    setSetPassError(t('networkError'))
                                                    setSetPassStep('code-sent')
                                                }
                                            }}>
                                                <div style={{ marginBottom: '8px' }}>
                                                    <label style={labelStyle}>{t('verificationCode')}</label>
                                                    <input type="text" inputMode="numeric" maxLength={6} value={setPassCode} onChange={e => setSetPassCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" style={{ ...inputStyle, letterSpacing: '6px', fontFamily: 'monospace', textAlign: 'center', fontSize: '1.1rem' }} required />
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                                                    <div>
                                                        <label style={labelStyle}>{t('newPassword')}</label>
                                                        <input type="password" value={setPassNew} onChange={e => setSetPassNew(e.target.value)} placeholder={t('minChars')} minLength={6} style={inputStyle} required />
                                                    </div>
                                                    <div>
                                                        <label style={labelStyle}>{t('confirm')}</label>
                                                        <input type="password" value={setPassConfirm} onChange={e => setSetPassConfirm(e.target.value)} placeholder={t('reenterPassword')} style={inputStyle} required />
                                                    </div>
                                                </div>
                                                <button type="submit" disabled={setPassStep === 'setting'} className="btn btn-primary" style={{ padding: '0.5rem 1.4rem', fontSize: '0.78rem', fontWeight: 700, opacity: setPassStep === 'setting' ? 0.7 : 1 }}>
                                                    {setPassStep === 'setting' ? t('saving') : t('setPasswordBtn')}
                                                </button>
                                            </form>
                                        )}
                                    </>
                                )}
                            </>
                        ) : (
                            /* ── Credential user: Change Password flow ──────── */
                            <>
                                <p style={sectionDesc}>{t('securityDesc')}</p>
                                <form onSubmit={handleProfileUpdate}>
                                    <div style={{ marginBottom: '8px' }}>
                                        <label style={labelStyle}>{t('currentPassword')}</label>
                                        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" style={inputStyle} />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                                        <div>
                                            <label style={labelStyle}>{t('newPassword')}</label>
                                            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('minChars')} minLength={6} style={inputStyle} />
                                        </div>
                                        <div>
                                            <label style={labelStyle}>{t('confirm')}</label>
                                            <input type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} placeholder={t('reenterPassword')} style={inputStyle} />
                                        </div>
                                    </div>
                                    <button type="submit" disabled={profileStatus === 'saving'} className="btn btn-primary" style={{ padding: '0.5rem 1.4rem', fontSize: '0.78rem', fontWeight: 700, opacity: profileStatus === 'saving' ? 0.7 : 1 }}>
                                        {profileStatus === 'saving' ? t('saving') : t('updatePassword')}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </ScrollReveal3D>

            {/* ────── ROW 3: Appearance + Notifications (side by side) ────── */}
            <ScrollReveal3D direction="up" delay={220} distance={15}>
                <div className="profile-grid-2col">
                    {/* Appearance */}
                    <div style={cardStyle}>
                        <h3 style={sectionTitle}>🎨 {t('appearance')}</h3>
                        <p style={sectionDesc}>{t('appearanceDesc')}</p>

                        {/* Accent colour picker */}
                        <label style={{ ...labelStyle, marginBottom: '8px' }}>{t('accentColour')}</label>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: '10px' }}>{t('accentColourDesc')}</div>
                        <div
                            role="radiogroup"
                            aria-label="Accent colour selection"
                            style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}
                        >
                            {ACCENTS.map((a) => (
                                <button
                                    key={a.key}
                                    className="accent-swatch"
                                    role="radio"
                                    aria-checked={accentKey === a.key}
                                    aria-label={`${t(a.i18nKey)} accent`}
                                    title={t(a.i18nKey)}
                                    onClick={() => handleAccent(a.key)}
                                    style={{
                                        width: '26px', height: '26px', borderRadius: '50%',
                                        background: a.base,
                                        border: accentKey === a.key
                                            ? `3px solid var(--bg-card)`
                                            : '3px solid transparent',
                                        outline: accentKey === a.key
                                            ? `2px solid ${a.base}`
                                            : '2px solid transparent',
                                        outlineOffset: '2px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: accentKey === a.key ? `0 0 12px ${a.glow}` : 'none',
                                        transform: accentKey === a.key ? 'scale(1.18)' : 'scale(1)',
                                        flexShrink: 0,
                                    }}
                                />

                            ))}
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginLeft: '4px' }}>
                                {t(ACCENTS.find(a => a.key === accentKey)?.i18nKey ?? 'colorGold')}
                            </span>
                        </div>
                    </div>


                    {/* Notifications — persisted to localStorage */}
                    <div style={cardStyle}>
                        <h3 style={sectionTitle}>🔔 {t('notifications')}</h3>
                        <p style={sectionDesc}>{t('notificationsDesc')}</p>
                        {([
                            { key: 'appUpdates' as const, label: t('appUpdates'), desc: t('appUpdatesDesc'), checked: notifAppUpdates, setter: setNotifAppUpdates },
                            { key: 'castingAlerts' as const, label: t('castingAlerts'), desc: t('castingAlertsDesc'), checked: notifCastingAlerts, setter: setNotifCastingAlerts },
                            { key: 'donationReceipts' as const, label: t('donationReceipts'), desc: t('donationReceiptsDesc'), checked: notifDonationReceipts, setter: setNotifDonationReceipts },
                        ]).map((n, i) => (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                                padding: '8px 0',
                                borderBottom: i < 2 ? '1px solid var(--border-subtle)' : 'none',
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>{n.label}</div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{n.desc}</div>
                                </div>
                                <button onClick={() => toggleNotif(n.key, n.checked, n.setter)} style={{
                                    width: '38px', height: '20px', borderRadius: '10px', border: 'none',
                                    background: n.checked ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)',
                                    position: 'relative', cursor: 'pointer', transition: 'background 0.3s', flexShrink: 0,
                                }}>
                                    <div style={{
                                        width: '16px', height: '16px', borderRadius: '50%',
                                        background: '#fff', position: 'absolute', top: '2px',
                                        left: n.checked ? '20px' : '2px',
                                        transition: 'left 0.3s ease',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                    }} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </ScrollReveal3D>
        </div>
    )
}
