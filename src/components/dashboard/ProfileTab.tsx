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
    }
    refreshUser: () => Promise<void>
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

export default function ProfileTab({ user, refreshUser }: ProfileTabProps) {
    const t = useTranslations('profileTab')
    const [profileName, setProfileName] = useState(user.name)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmNewPassword, setConfirmNewPassword] = useState('')
    const [profileStatus, setProfileStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [profileError, setProfileError] = useState('')
    const [bannerUploading, setBannerUploading] = useState(false)

    // Theme — persisted in localStorage
    const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'system'>('dark')
    useEffect(() => {
        const saved = localStorage.getItem('aim-theme') as 'dark' | 'light' | 'system' | null
        if (saved) {
            setThemeMode(saved)
            applyTheme(saved)
        }
    }, [])

    function applyTheme(mode: 'dark' | 'light' | 'system') {
        if (mode === 'light') document.documentElement.setAttribute('data-theme', 'light')
        else if (mode === 'dark') document.documentElement.removeAttribute('data-theme')
        else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            if (prefersDark) document.documentElement.removeAttribute('data-theme')
            else document.documentElement.setAttribute('data-theme', 'light')
        }
    }

    function handleTheme(key: 'dark' | 'light' | 'system') {
        setThemeMode(key)
        localStorage.setItem('aim-theme', key)
        applyTheme(key)
    }

    // Notifications — persisted in localStorage
    const [notifAppUpdates, setNotifAppUpdates] = useState(true)
    const [notifCastingAlerts, setNotifCastingAlerts] = useState(true)
    const [notifDonationReceipts, setNotifDonationReceipts] = useState(true)

    useEffect(() => {
        setNotifAppUpdates(readBool(NOTIF_KEYS.appUpdates, true))
        setNotifCastingAlerts(readBool(NOTIF_KEYS.castingAlerts, true))
        setNotifDonationReceipts(readBool(NOTIF_KEYS.donationReceipts, true))
    }, [])

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
            } else { setProfileError(data.error || t('updateFailed')); setProfileStatus('error') }
        } catch { setProfileError(t('networkError')); setProfileStatus('error') }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>

            {/* ────── ROW 1: Profile Summary + Banner (side by side) ────── */}
            <ScrollReveal3D direction="up" delay={80} distance={15}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                    {/* Profile Avatar Card */}
                    <div style={{
                        ...cardStyle,
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', textAlign: 'center', position: 'relative', overflow: 'hidden',
                    }}>
                        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '140px', height: '140px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
                        <div style={{
                            width: '52px', height: '52px', borderRadius: '50%',
                            background: 'linear-gradient(135deg, var(--accent-gold), #b8941f)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.3rem', fontWeight: 800, color: '#000',
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
                                { href: '/casting', label: `🎬 ${t('exploreCasting')}` },
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
                                background: 'linear-gradient(135deg, var(--accent-gold), #b8941f)',
                                color: '#000', borderRadius: 'var(--radius-sm)',
                                cursor: bannerUploading ? 'wait' : 'pointer',
                                opacity: bannerUploading ? 0.6 : 1,
                            }}>
                                {bannerUploading ? `⏳ ${t('uploading')}` : `📷 ${t('uploadBanner')}`}
                                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{ display: 'none' }} onChange={handleBannerUpload} disabled={bannerUploading} />
                            </label>
                            {user.bannerUrl && (
                                <button onClick={handleRemoveBanner} style={{
                                    padding: '0.4rem 0.8rem', fontSize: '0.72rem', fontWeight: 600,
                                    background: 'rgba(239,68,68,0.12)', color: '#ef4444',
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                    {/* Personal Info */}
                    <div style={cardStyle}>
                        <h3 style={sectionTitle}>✏️ {t('personalInfo')}</h3>
                        <p style={sectionDesc}>{t('personalInfoDesc')}</p>
                        {profileStatus === 'saved' && (
                            <div style={{ padding: '6px 10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: '10px', fontSize: '0.75rem', color: '#22c55e' }}>✓ {t('profileUpdated')}</div>
                        )}
                        {profileError && (
                            <div style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-sm)', marginBottom: '10px', fontSize: '0.75rem', color: '#ef4444' }}>{profileError}</div>
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
                    </div>
                </div>
            </ScrollReveal3D>

            {/* ────── ROW 3: Appearance + Notifications (side by side) ────── */}
            <ScrollReveal3D direction="up" delay={220} distance={15}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                    {/* Appearance */}
                    <div style={cardStyle}>
                        <h3 style={sectionTitle}>🎨 {t('appearance')}</h3>
                        <p style={sectionDesc}>{t('appearanceDesc')}</p>
                        <div style={{ display: 'flex', gap: '3px', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius-sm)', padding: '3px', border: '1px solid var(--border-subtle)' }}>
                            {([['dark', `🌙 ${t('dark')}`], ['light', `☀️ ${t('light')}`], ['system', `💻 ${t('system')}`]] as const).map(([key, label]) => (
                                <button key={key} onClick={() => handleTheme(key)} style={{
                                    flex: 1, padding: '0.45rem 0.6rem', fontSize: '0.72rem', fontWeight: 600,
                                    border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                    background: themeMode === key ? 'var(--accent-gold)' : 'transparent',
                                    color: themeMode === key ? '#000' : 'var(--text-tertiary)',
                                    transition: 'all 0.25s ease',
                                    boxShadow: themeMode === key ? '0 2px 8px rgba(212,168,83,0.3)' : 'none',
                                }}>{label}</button>
                            ))}
                        </div>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '8px' }}>{t('systemDesc')}</p>
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
