'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import AdminSidebar from '@/components/AdminSidebar'

/* ── Types ── */
type SocialLinks = { youtube: string; instagram: string; tiktok: string; x: string; imdb: string }

type AboutPageData = {
    heroSubtitle: string
    philosophyQuote: string; philosophyAuthor: string; philosophyRole: string
    stat1Value: number; stat1Label: string; stat2Value: number; stat2Label: string
    stat3Value: number; stat3Label: string; stat4Value: number; stat4Label: string
    milestone1Year: string; milestone1Title: string; milestone1Desc: string
    milestone2Year: string; milestone2Title: string; milestone2Desc: string
    milestone3Year: string; milestone3Title: string; milestone3Desc: string
    value1Title: string; value1Sub: string; value1Desc: string
    value2Title: string; value2Sub: string; value2Desc: string
    value3Title: string; value3Sub: string; value3Desc: string
    ctaTitle: string; ctaTitleAccent: string; ctaDesc: string
    ctaButtonText: string; ctaSecondaryText: string
}

const EMPTY_ABOUT: AboutPageData = {
    heroSubtitle: '', philosophyQuote: '', philosophyAuthor: '', philosophyRole: '',
    stat1Value: 0, stat1Label: '', stat2Value: 0, stat2Label: '',
    stat3Value: 0, stat3Label: '', stat4Value: 0, stat4Label: '',
    milestone1Year: '', milestone1Title: '', milestone1Desc: '',
    milestone2Year: '', milestone2Title: '', milestone2Desc: '',
    milestone3Year: '', milestone3Title: '', milestone3Desc: '',
    value1Title: '', value1Sub: '', value1Desc: '',
    value2Title: '', value2Sub: '', value2Desc: '',
    value3Title: '', value3Sub: '', value3Desc: '',
    ctaTitle: '', ctaTitleAccent: '', ctaDesc: '',
    ctaButtonText: '', ctaSecondaryText: '',
}

type Settings = {
    siteName: string; tagline: string; aboutText: string; studioStory: string; mission: string
    aboutPageData: string
    logoUrl: string; contactEmail: string; contactPhone: string; address: string
    socialLinks: SocialLinks
    // AI
    geminiApiKey: string; aiModel: string; aiCustomPrompt: string; aiAutoAudit: boolean
    // Pipeline Automation
    autoShortlistThreshold: number; autoRejectThreshold: number; pipelineAutoAdvance: boolean; notifyApplicantOnStatusChange: boolean
    notifyOnNewRole: boolean
    notifyOnAnnouncement: boolean
    notifyOnContentPublish: boolean
    // Casting
    defaultDeadlineDays: number; castingAutoClose: boolean; requireVoice: boolean; maxPhotoUploads: number
    // Content
    requireLoginForFilms: boolean; allowPublicTrailers: boolean
    requireLoginForCasting: boolean; requireLoginForDonate: boolean
    requireLoginForSponsors: boolean; allowPublicProjectPages: boolean
    trailerPreviewEnabled: boolean; trailerPreviewSeconds: number; trailerPreviewMessage: string
    // Donations
    donationsEnabled: boolean; donationMinAmount: number
    // Notifications
    notifyOnApplication: boolean; notifyOnDonation: boolean; notifyEmail: string
    // Section Visibility
    scriptCallsEnabled: boolean
    castingCallsEnabled: boolean
    trainingEnabled: boolean
    sponsorsPageEnabled: boolean
    // OAuth
    googleClientId: string; googleClientSecret: string
    appleClientId: string; appleTeamId: string; appleKeyId: string; applePrivateKey: string
    // Email
    smtpHost: string; smtpPort: number; smtpUser: string; smtpPass: string
    smtpFromName: string; smtpFromEmail: string; smtpSecure: boolean
    emailsEnabled: boolean; emailTransport: string; emailReplyTo: string
}

const TABS = [
    { key: 'general', label: '🏷️ General' },
    { key: 'about', label: '📖 About & Mission' },
    { key: 'contact', label: '📬 Contact & Social' },
    { key: 'apikeys', label: '🔑 API Keys & Agents' },
    { key: 'casting', label: '🎬 Casting' },
    { key: 'content', label: '🔒 Content Access' },
    { key: 'auth', label: '🔐 Authentication' },
    { key: 'donations', label: '💰 Donations' },
    { key: 'email', label: '📧 Microsoft Graph Email' },
    { key: 'security', label: '🔐 Security' },
] as const

const AI_MODELS = [
    { value: 'llama-3.3-70b-versatile', label: '⚡ Llama 3.3 70B (Groq, recommended)' },
    { value: 'llama-3.1-8b-instant', label: '⚡ Llama 3.1 8B (Groq, fastest)' },
    { value: 'mixtral-8x7b-32768', label: '⚡ Mixtral 8x7B (Groq)' },
    { value: 'deepseek-r1-distill-llama-70b', label: '⚡ DeepSeek R1 70B (Groq)' },
    { value: 'gemini-2.5-flash', label: '🔷 Gemini 2.5 Flash (recommended)' },
    { value: 'gemini-2.5-pro', label: '🔷 Gemini 2.5 Pro' },
    { value: 'gemini-3-flash', label: '🔷 Gemini 3 Flash' },
    { value: 'gpt-4o', label: '🟢 GPT-4o (OpenAI)' },
    { value: 'gpt-4o-mini', label: '🟢 GPT-4o Mini (OpenAI)' },
    { value: 'gpt-4-turbo', label: '🟢 GPT-4 Turbo (OpenAI)' },
]

const SIDEBAR_LINKS = [
    { href: '/admin/analytics', label: '📊 Analytics' },
    { href: '/admin/projects', label: '🎬 Projects' },
    { href: '/admin/casting', label: '🎭 Casting' },
    { href: '/admin/applications', label: '📋 Applications' },
    { href: '/admin/media', label: '🖼️ Page Media' },
    { href: '/admin/sponsors', label: '🤝 Sponsors' },
    { href: '/admin/donations', label: '💰 Donations' },
    { href: '/admin/users', label: '👥 Users' },
    { href: '/admin/scripts', label: '✍️ Scripts' },
    { href: '/admin/settings', label: '⚙️ Settings', active: true },
]

/* ── Email / SMTP Tab Component ── */
function EmailSmtpTab({ settings, update, Toggle }: {
    settings: Settings
    update: (field: keyof Settings, value: unknown) => void
    Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }>
}) {
    const [testingSending, setTestSending] = useState(false)
    const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const transport = settings.emailTransport || 'graph'
    const isGraph = transport === 'graph'

    const handleTestEmail = async () => {
        const to = settings.notifyEmail || settings.contactEmail
        if (!to) { setTestResult({ ok: false, msg: 'Set a Notification Email (Donations tab) or Contact Email first.' }); return }
        setTestSending(true); setTestResult(null)
        try {
            const res = await fetch('/api/admin/test-email', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to }),
            })
            const data = await res.json()
            if (res.ok) setTestResult({ ok: true, msg: `✅ Test email sent to ${to}` })
            else setTestResult({ ok: false, msg: data.error || 'Send failed' })
        } catch { setTestResult({ ok: false, msg: 'Connection error' }) }
        finally { setTestSending(false) }
    }

    const handleSave = async () => {
        setSaving(true); setSaved(false); setTestResult(null)
        try {
            const body = {
                ...settings,
                socialLinks: typeof settings.socialLinks === 'string'
                    ? settings.socialLinks
                    : JSON.stringify(settings.socialLinks),
            }
            const res = await fetch('/api/admin/settings', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            })
            const data = await res.json()
            if (!res.ok) {
                setTestResult({ ok: false, msg: `Save failed: ${data.error || data.details || 'Unknown error'}` })
                return
            }
            setSaved(true)
            setTestResult({ ok: true, msg: '✅ Email settings saved successfully!' })
            setTimeout(() => setSaved(false), 3000)
        } catch (err) {
            setTestResult({ ok: false, msg: `Save failed: ${err instanceof Error ? err.message : 'Network error'}` })
        } finally { setSaving(false) }
    }

    const cardBase: React.CSSProperties = {
        flex: 1, padding: '16px 18px', borderRadius: 'var(--radius-lg)',
        cursor: 'pointer', transition: 'all 0.18s', display: 'flex',
        flexDirection: 'column', gap: '6px',
    }

    return (
        <section className="admin-form-section">
            <h3 className="admin-form-section-title">📧 Email Configuration</h3>

            {/* ─── Master Enable Toggle ─── */}
            <div style={{
                padding: 'var(--space-lg)', marginBottom: 'var(--space-xl)',
                background: settings.emailsEnabled ? 'rgba(52,211,153,0.04)' : 'rgba(239,68,68,0.03)',
                border: `1px solid ${settings.emailsEnabled ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.1)'}`,
                borderRadius: 'var(--radius-lg)',
            }}>
                <Toggle checked={settings.emailsEnabled} onChange={v => update('emailsEnabled', v)} label="Enable email sending" />
                <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    {settings.emailsEnabled
                        ? '✅ Emails are active. Choose a transport below.'
                        : '🔇 All outgoing emails are paused. Enable to configure.'}
                </div>
            </div>

            {/* ─── Transport Picker ─── */}
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Email Transport
            </div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: 'var(--space-xl)' }}>
                {/* Microsoft Graph card */}
                <div
                    onClick={() => update('emailTransport', 'graph')}
                    style={{
                        ...cardBase,
                        background: isGraph ? 'rgba(59,130,246,0.08)' : 'var(--bg-secondary)',
                        border: isGraph ? '2px solid rgba(59,130,246,0.5)' : '1px solid var(--border-subtle)',
                        boxShadow: isGraph ? '0 0 0 1px rgba(59,130,246,0.15)' : 'none',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: 16, height: 16, borderRadius: '50%',
                            border: `2px solid ${isGraph ? '#3b82f6' : 'var(--border-subtle)'}`,
                            background: isGraph ? '#3b82f6' : 'transparent',
                            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {isGraph && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>🔵 Microsoft Graph</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', paddingLeft: '24px' }}>
                        Send via Azure registered app. No SMTP server needed. Recommended for Office 365 / Exchange.
                    </div>
                    {isGraph && (
                        <div style={{ fontSize: '0.65rem', color: '#3b82f6', paddingLeft: '24px', marginTop: '2px' }}>
                            ✓ Uses AZURE_TENANT_ID / CLIENT_ID / CLIENT_SECRET from environment
                        </div>
                    )}
                </div>

                {/* SMTP card */}
                <div
                    onClick={() => update('emailTransport', 'smtp')}
                    style={{
                        ...cardBase,
                        background: !isGraph ? 'rgba(212,168,83,0.06)' : 'var(--bg-secondary)',
                        border: !isGraph ? '2px solid rgba(212,168,83,0.4)' : '1px solid var(--border-subtle)',
                        boxShadow: !isGraph ? '0 0 0 1px rgba(212,168,83,0.12)' : 'none',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: 16, height: 16, borderRadius: '50%',
                            border: `2px solid ${!isGraph ? '#d4a853' : 'var(--border-subtle)'}`,
                            background: !isGraph ? '#d4a853' : 'transparent',
                            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            {!isGraph && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>📮 SMTP</span>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', paddingLeft: '24px' }}>
                        Send via any SMTP server (Gmail, Mailgun, SendGrid, custom). Enter credentials below.
                    </div>
                    {!isGraph && (
                        <div style={{ fontSize: '0.65rem', color: '#d4a853', paddingLeft: '24px', marginTop: '2px' }}>
                            ✓ Uses the credentials you enter below
                        </div>
                    )}
                </div>
            </div>

            {/* ─── Sender Identity (always visible) ─── */}
            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
                ✉️ Sender Identity
            </div>
            <div className="admin-form-grid" style={{ marginBottom: 'var(--space-xl)' }}>
                <div>
                    <label className="admin-label">From Name</label>
                    <input className="admin-input" value={settings.smtpFromName} onChange={e => update('smtpFromName', e.target.value)} placeholder="AIM Studio" />
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>Display name recipients see</div>
                </div>
                <div>
                    <label className="admin-label">From Email</label>
                    <input className="admin-input" type="email" value={settings.smtpFromEmail} onChange={e => update('smtpFromEmail', e.target.value)}
                        placeholder={isGraph ? 'aimstudio@impactaistudio.com' : 'noreply@yourdomain.com'} />
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        {isGraph ? 'Must be a mailbox licensed in your Azure tenant' : 'The address emails are sent from'}
                    </div>
                </div>
                <div>
                    <label className="admin-label">Reply-To Email <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                    <input className="admin-input" type="email" value={settings.emailReplyTo} onChange={e => update('emailReplyTo', e.target.value)}
                        placeholder="noreply@impactaistudio.com" />
                    <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                        Leave blank to allow replies to From Email. Set to noreply@impactaistudio.com to block replies.
                    </div>
                </div>
            </div>

            {/* ─── SMTP Credentials (only when smtp is selected) ─── */}
            {!isGraph && (
                <>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: 'var(--space-lg) 0' }} />
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#d4a853', marginBottom: 'var(--space-md)' }}>
                        🔐 SMTP Credentials
                    </div>
                    <div className="admin-form-grid" style={{ marginBottom: 'var(--space-md)' }}>
                        <div>
                            <label className="admin-label">SMTP Host</label>
                            <input className="admin-input" value={settings.smtpHost} onChange={e => update('smtpHost', e.target.value)} placeholder="smtp.gmail.com" />
                        </div>
                        <div>
                            <label className="admin-label">SMTP Port</label>
                            <input className="admin-input" type="number" value={settings.smtpPort} onChange={e => update('smtpPort', parseInt(e.target.value))} placeholder="587" />
                        </div>
                        <div>
                            <label className="admin-label">Username / Email</label>
                            <input className="admin-input" value={settings.smtpUser} onChange={e => update('smtpUser', e.target.value)} placeholder="you@gmail.com" />
                        </div>
                        <div>
                            <label className="admin-label">Password / App Password</label>
                            <input className="admin-input" type="password" value={settings.smtpPass} onChange={e => update('smtpPass', e.target.value)} placeholder="•••••••••••••••" />
                        </div>
                    </div>
                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                        <Toggle checked={settings.smtpSecure} onChange={v => update('smtpSecure', v)} label="Use SSL (port 465)" />
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                            Off = STARTTLS on port 587 (recommended). On = SSL on port 465.
                        </div>
                    </div>
                </>
            )}

            {/* ─── Save + Test ─── */}
            <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', marginTop: 'var(--space-xl)', flexWrap: 'wrap' }}>
                <button type="button" onClick={handleSave} className="btn btn-primary" disabled={saving} style={{ minWidth: '160px' }}>
                    {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save Email Settings'}
                </button>
                <button type="button" onClick={handleTestEmail} className="btn btn-primary btn-sm"
                    disabled={testingSending || !settings.emailsEnabled}
                    style={{
                        opacity: settings.emailsEnabled ? 1 : 0.4,
                        background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)',
                        color: 'var(--success)', whiteSpace: 'nowrap',
                    }}>
                    {testingSending ? '⏳ Sending…' : '📤 Send Test Email'}
                </button>
                {!settings.emailsEnabled && (
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Enable emails above to test</span>
                )}
            </div>
            {testResult && (
                <div style={{
                    marginTop: 'var(--space-md)', padding: '10px 14px', borderRadius: 'var(--radius-md)',
                    fontSize: '0.78rem', lineHeight: 1.5,
                    background: testResult.ok ? 'rgba(52,211,153,0.06)' : 'rgba(239,68,68,0.06)',
                    border: `1px solid ${testResult.ok ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)'}`,
                    color: testResult.ok ? 'var(--success)' : '#ef4444',
                }}>
                    {testResult.msg}
                </div>
            )}

            {/* ─── What gets emailed ─── */}
            <div style={{
                marginTop: 'var(--space-2xl)', padding: 'var(--space-lg)',
                background: 'rgba(139,92,246,0.03)', borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(139,92,246,0.1)',
            }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a855f7', marginBottom: 'var(--space-md)' }}>
                    📋 Emails That Will Be Sent
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.75rem' }}>
                    {[
                        { event: 'New user registers', to: 'User' },
                        { event: 'Newsletter subscribe', to: 'Subscriber' },
                        { event: 'Contact form submit', to: 'Sender + Admin' },
                        { event: 'Donation received', to: 'Donor + Admin' },
                        { event: 'Casting application', to: 'Applicant + Admin' },
                        { event: 'Application status change', to: 'Applicant' },
                        { event: 'Script submission', to: 'Author' },
                        { event: 'Password reset', to: 'User (6-digit code)' },
                    ].map(e => (
                        <div key={e.event} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(139,92,246,0.06)' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{e.event}</span>
                            <span style={{ color: 'var(--text-tertiary)', fontSize: '0.68rem' }}>→ {e.to}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Email Template Preview Gallery */}
            <EmailPreviewGallery />
        </section>
    )
}

/* ── Email Template Preview Gallery ── */
function EmailPreviewGallery() {
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
    const [previewHtml, setPreviewHtml] = useState('')
    const [previewSubject, setPreviewSubject] = useState('')
    const [loadingPreview, setLoadingPreview] = useState(false)
    const [editMode, setEditMode] = useState(false)
    const [editFields, setEditFields] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState(false)
    const [saveMsg, setSaveMsg] = useState('')

    // Define editable fields per template
    const TEMPLATE_FIELDS: Record<string, { label: string; key: string; type: 'text' | 'textarea' }[]> = {
        welcome: [
            { label: 'Heading', key: 'heading', type: 'text' },
            { label: 'Subtitle', key: 'subtitle', type: 'text' },
            { label: 'Body Text', key: 'body', type: 'textarea' },
            { label: 'Button Text', key: 'buttonText', type: 'text' },
        ],
        subscribe: [
            { label: 'Heading', key: 'heading', type: 'text' },
            { label: 'Subtitle', key: 'subtitle', type: 'text' },
            { label: 'Body Text', key: 'body', type: 'textarea' },
        ],
        contact: [
            { label: 'Heading', key: 'heading', type: 'text' },
            { label: 'Subtitle', key: 'subtitle', type: 'text' },
            { label: 'Body Text', key: 'body', type: 'textarea' },
        ],
        donation: [
            { label: 'Heading', key: 'heading', type: 'text' },
            { label: 'Subtitle', key: 'subtitle', type: 'text' },
            { label: 'Body Text', key: 'body', type: 'textarea' },
            { label: 'Button Text', key: 'buttonText', type: 'text' },
        ],
        application: [
            { label: 'Heading', key: 'heading', type: 'text' },
            { label: 'Subtitle', key: 'subtitle', type: 'text' },
            { label: 'Body Text', key: 'body', type: 'textarea' },
            { label: 'Button Text', key: 'buttonText', type: 'text' },
        ],
        statusUpdate: [
            { label: 'Heading', key: 'heading', type: 'text' },
            { label: 'Subtitle', key: 'subtitle', type: 'text' },
        ],
        scriptSubmission: [
            { label: 'Heading', key: 'heading', type: 'text' },
            { label: 'Subtitle', key: 'subtitle', type: 'text' },
            { label: 'Body Text', key: 'body', type: 'textarea' },
            { label: 'Button Text', key: 'buttonText', type: 'text' },
        ],
        passwordChanged: [
            { label: 'Heading', key: 'heading', type: 'text' },
            { label: 'Subtitle', key: 'subtitle', type: 'text' },
            { label: 'Body Text', key: 'body', type: 'textarea' },
            { label: 'Warning Text', key: 'warning', type: 'textarea' },
            { label: 'Button Text', key: 'buttonText', type: 'text' },
        ],
        newDeviceLogin: [
            { label: 'Heading', key: 'heading', type: 'text' },
            { label: 'Subtitle', key: 'subtitle', type: 'text' },
            { label: 'Safe Message', key: 'body', type: 'textarea' },
            { label: 'Warning Text', key: 'warning', type: 'textarea' },
            { label: 'Button Text', key: 'buttonText', type: 'text' },
        ],
    }

    const TEMPLATES = [
        { key: 'welcome', label: '👋 Welcome', desc: 'New user registration', editable: true },
        { key: 'subscribe', label: '🎉 Subscribe', desc: 'Newsletter subscription', editable: true },
        { key: 'contact', label: '✉️ Contact Reply', desc: 'Auto-reply to sender', editable: true },
        { key: 'contactAdmin', label: '📬 Contact Alert', desc: 'Admin notification', editable: false },
        { key: 'donation', label: '💛 Donation Receipt', desc: 'Thank-you to donor', editable: true },
        { key: 'donationAdmin', label: '💰 Donation Alert', desc: 'Admin donation notice', editable: false },
        { key: 'application', label: '🎭 Application', desc: 'Casting confirmation', editable: true },
        { key: 'applicationAdmin', label: '📋 App. Alert', desc: 'Admin casting notice', editable: false },
        { key: 'statusUpdate', label: '📊 Status Update', desc: 'Application status change', editable: true },
        { key: 'forgotPassword', label: '🔐 Password Reset', desc: '6-digit verification code', editable: false },
        { key: 'scriptSubmission', label: '✍️ Script', desc: 'Script submission confirm', editable: true },
        { key: 'verification', label: '📧 Verification', desc: 'Email verification code', editable: false },
        { key: 'passwordChanged', label: '🔒 Password Changed', desc: 'Security notification', editable: true },
        { key: 'newDeviceLogin', label: '🚨 New Device', desc: 'Login security alert', editable: true },
    ]

    const handlePreview = async (key: string) => {
        setSelectedTemplate(key)
        setEditMode(false)
        setSaveMsg('')
        setEditFields({})
        setLoadingPreview(true)
        try {
            const res = await fetch(`/api/admin/email-preview?template=${key}`)
            const data = await res.json()
            setPreviewHtml(data.html)
            setPreviewSubject(data.subject)
            // Load any saved overrides for this template
            if (data.overrides) setEditFields(data.overrides)
        } catch { setPreviewHtml('<p>Failed to load preview</p>') }
        finally { setLoadingPreview(false) }
    }

    const handleSave = async () => {
        if (!selectedTemplate) return
        setSaving(true)
        setSaveMsg('')
        try {
            const res = await fetch('/api/admin/email-templates', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateKey: selectedTemplate, fields: editFields }),
            })
            if (res.ok) {
                setSaveMsg('✅ Changes saved')
            } else {
                setSaveMsg('❌ Failed to save')
            }
        } catch { setSaveMsg('❌ Failed to save') }
        finally { setSaving(false) }
    }

    const handleReset = async () => {
        if (!selectedTemplate) return
        if (!confirm('Reset this template to defaults? Any custom changes will be lost.')) return
        setSaving(true)
        setSaveMsg('')
        try {
            const res = await fetch('/api/admin/email-templates', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ templateKey: selectedTemplate }),
            })
            if (res.ok) {
                setSaveMsg('✅ Reset to default')
                setEditFields({})
                await handlePreview(selectedTemplate)
            } else {
                setSaveMsg('❌ Failed to reset')
            }
        } catch { setSaveMsg('❌ Failed to reset') }
        finally { setSaving(false) }
    }

    const closeModal = () => { setSelectedTemplate(null); setEditMode(false); setSaveMsg(''); setEditFields({}) }

    const updateField = (key: string, value: string) => {
        setEditFields(prev => ({ ...prev, [key]: value }))
    }

    const inputStyle = {
        width: '100%', padding: '8px 12px', borderRadius: '6px',
        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
        color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none',
        transition: 'border-color 0.2s',
    }
    const labelStyle = {
        display: 'block', fontSize: '0.65rem', fontWeight: 600 as const,
        color: 'var(--text-tertiary)', marginBottom: '4px',
        textTransform: 'uppercase' as const, letterSpacing: '0.05em',
    }

    return (
        <>
            <div style={{
                marginTop: 'var(--space-2xl)', padding: 'var(--space-lg)',
                background: 'rgba(59,130,246,0.03)', borderRadius: 'var(--radius-lg)',
                border: '1px solid rgba(59,130,246,0.1)',
            }}>
                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3b82f6', marginBottom: 'var(--space-md)' }}>
                    👁️ Email Templates — Preview & Edit
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                    {TEMPLATES.map(t => (
                        <button key={t.key} type="button" onClick={() => handlePreview(t.key)} style={{
                            padding: '10px 8px', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
                            background: selectedTemplate === t.key ? 'rgba(59,130,246,0.08)' : 'var(--bg-primary)',
                            border: selectedTemplate === t.key ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--border-subtle)',
                            transition: 'all 0.2s',
                        }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                                {t.label}
                            </div>
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>
                                {t.desc} {t.editable && <span style={{ color: '#d4a853' }}>✏️</span>}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Preview / Edit Modal */}
            {selectedTemplate && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999,
                    background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                }} onClick={closeModal}>
                    <div style={{
                        width: '100%', maxWidth: editMode ? '960px' : '660px', maxHeight: '88vh',
                        display: 'flex', flexDirection: 'column',
                        borderRadius: 'var(--radius-xl)', overflow: 'hidden',
                        border: '1px solid var(--border-subtle)',
                        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                        transition: 'max-width 0.3s ease',
                    }} onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div style={{
                            padding: '12px 20px', background: 'var(--bg-secondary)',
                            borderBottom: '1px solid var(--border-subtle)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div>
                                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                                    {editMode ? '✏️ Edit Template' : '👁️ Email Preview'}
                                </div>
                                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                    📧 {previewSubject}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {saveMsg && <span style={{ fontSize: '0.7rem', color: saveMsg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{saveMsg}</span>}
                                {TEMPLATES.find(t => t.key === selectedTemplate)?.editable && (
                                    <button type="button" onClick={() => { setEditMode(!editMode); setSaveMsg('') }} style={{
                                        padding: '5px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                        background: editMode ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
                                        border: editMode ? '1px solid rgba(59,130,246,0.3)' : '1px solid var(--border-subtle)',
                                        color: editMode ? '#3b82f6' : 'var(--text-secondary)',
                                        fontSize: '0.7rem', fontWeight: 600, transition: 'all 0.2s',
                                    }}>
                                        {editMode ? '👁️ Preview' : '✏️ Edit'}
                                    </button>
                                )}
                                <button type="button" onClick={closeModal} style={{
                                    background: 'none', border: 'none', color: 'var(--text-tertiary)',
                                    fontSize: '1.2rem', cursor: 'pointer', padding: '4px',
                                }}>✕</button>
                            </div>
                        </div>
                        {/* Body */}
                        <div style={{ flex: 1, overflow: 'auto', background: '#0f1115' }}>
                            {loadingPreview ? (
                                <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                    Loading preview…
                                </div>
                            ) : editMode && selectedTemplate && TEMPLATE_FIELDS[selectedTemplate] ? (
                                <div style={{ display: 'flex', height: '600px' }}>
                                    {/* Left: Form Fields */}
                                    <div style={{
                                        width: '340px', minWidth: '340px', padding: '20px',
                                        borderRight: '1px solid var(--border-subtle)',
                                        overflowY: 'auto', background: 'var(--bg-secondary)',
                                    }}>
                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#d4a853', marginBottom: '16px' }}>
                                            Customize Content
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                            {TEMPLATE_FIELDS[selectedTemplate].map(field => (
                                                <div key={field.key}>
                                                    <label style={labelStyle}>{field.label}</label>
                                                    {field.type === 'textarea' ? (
                                                        <textarea
                                                            value={editFields[field.key] || ''}
                                                            onChange={e => updateField(field.key, e.target.value)}
                                                            placeholder={`Default ${field.label.toLowerCase()}…`}
                                                            rows={3}
                                                            style={{ ...inputStyle, resize: 'vertical' as const, minHeight: '60px' }}
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={editFields[field.key] || ''}
                                                            onChange={e => updateField(field.key, e.target.value)}
                                                            placeholder={`Default ${field.label.toLowerCase()}…`}
                                                            style={inputStyle}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: '16px', lineHeight: 1.5 }}>
                                            💡 Leave fields empty to use defaults. Only fill in what you want to customize.
                                        </div>
                                        {/* Action buttons */}
                                        <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                                            <button type="button" onClick={handleReset} disabled={saving} style={{
                                                padding: '8px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                                                color: '#ef4444', fontSize: '0.7rem', fontWeight: 600,
                                                opacity: saving ? 0.5 : 1, flex: 1,
                                            }}>
                                                🔄 Reset
                                            </button>
                                            <button type="button" onClick={handleSave} disabled={saving} style={{
                                                padding: '8px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                                background: 'linear-gradient(135deg, #d4a853, #c49b3a)', border: 'none',
                                                color: '#0f1115', fontSize: '0.7rem', fontWeight: 700,
                                                opacity: saving ? 0.5 : 1, flex: 1,
                                            }}>
                                                {saving ? 'Saving…' : '💾 Save'}
                                            </button>
                                        </div>
                                    </div>
                                    {/* Right: Live Preview */}
                                    <div style={{ flex: 1 }}>
                                        <iframe
                                            srcDoc={previewHtml}
                                            style={{ width: '100%', height: '100%', border: 'none', background: '#0f1115' }}
                                            title="Email Preview"
                                            sandbox="allow-same-origin"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <iframe
                                    srcDoc={previewHtml}
                                    style={{ width: '100%', height: '600px', border: 'none', background: '#0f1115' }}
                                    title="Email Preview"
                                    sandbox="allow-same-origin"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}


export default function AdminSettingsPage() {
    const [tab, setTab] = useState<string>('general')
    const [settings, setSettings] = useState<Settings>({
        siteName: '', tagline: '', aboutText: '', studioStory: '', mission: '', aboutPageData: '',
        logoUrl: '', contactEmail: '', contactPhone: '', address: '',
        socialLinks: { youtube: '', instagram: '', tiktok: '', x: '', imdb: '' },
        geminiApiKey: '', aiModel: 'gemini-2.5-flash', aiCustomPrompt: '', aiAutoAudit: false,
        autoShortlistThreshold: 75, autoRejectThreshold: 25, pipelineAutoAdvance: true, notifyApplicantOnStatusChange: true,
        defaultDeadlineDays: 30, castingAutoClose: false, requireVoice: false, maxPhotoUploads: 6,
        requireLoginForFilms: true, allowPublicTrailers: true,
        requireLoginForCasting: false, requireLoginForDonate: false,
        requireLoginForSponsors: false, allowPublicProjectPages: true,
        trailerPreviewEnabled: false, trailerPreviewSeconds: 15, trailerPreviewMessage: '',
        donationsEnabled: true, donationMinAmount: 5,
        notifyOnApplication: true, notifyOnDonation: true, notifyEmail: '',
        scriptCallsEnabled: false,
        castingCallsEnabled: true,
        trainingEnabled: false,
        sponsorsPageEnabled: true,
        googleClientId: '', googleClientSecret: '',
        appleClientId: '', appleTeamId: '', appleKeyId: '', applePrivateKey: '',
        // Email
        smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '',
        smtpFromName: '', smtpFromEmail: '', smtpSecure: false,
        emailsEnabled: false, emailTransport: 'graph', emailReplyTo: '',
        notifyOnNewRole: true, notifyOnAnnouncement: true, notifyOnContentPublish: true,
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')
    const [dirty, setDirty] = useState(false)

    // Password change state
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [currentPassword, setCurrentPassword] = useState('')
    const [pwSaving, setPwSaving] = useState(false)
    const [pwMsg, setPwMsg] = useState('')
    const [newDisplayName, setNewDisplayName] = useState('')
    const [nameSaving, setNameSaving] = useState(false)
    const [nameMsg, setNameMsg] = useState('')

    // Admin management state
    interface AdminUser { id: string; name: string; email: string; role: string; createdAt: string }
    const [adminList, setAdminList] = useState<AdminUser[]>([])
    const [adminsLoading, setAdminsLoading] = useState(false)
    const [newAdminName, setNewAdminName] = useState('')
    const [newAdminEmail, setNewAdminEmail] = useState('')
    const [newAdminPassword, setNewAdminPassword] = useState('')
    const [createAdminSaving, setCreateAdminSaving] = useState(false)
    const [createAdminMsg, setCreateAdminMsg] = useState('')

    // API Keys state
    interface ApiKeyItem { id: string; label: string; provider: string; key: string; isActive: boolean; assignedAgent: string; usageCount: number; lastUsed: string | null; lastError: string | null; cooledDownUntil: string | null; createdAt: string }
    const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([])
    const [newKeyLabel, setNewKeyLabel] = useState('')
    const [newKeyValue, setNewKeyValue] = useState('')
    const [newKeyProvider, setNewKeyProvider] = useState('gemini')
    const [newKeyAgent, setNewKeyAgent] = useState('all')
    const [keysLoading, setKeysLoading] = useState(false)

    // API Keys advanced filtering & bulk actions
    const [keySearch, setKeySearch] = useState('')
    const [keyFilterProvider, setKeyFilterProvider] = useState('all')
    const [keyFilterAgent, setKeyFilterAgent] = useState('all')
    const [keyFilterStatus, setKeyFilterStatus] = useState('all')
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
    const [bulkActionLoading, setBulkActionLoading] = useState(false)
    const [bulkAgent, setBulkAgent] = useState('all')

    const handleBulkAction = async (action: 'enable' | 'disable' | 'delete' | 'clearErrors' | 'assignAgent') => {
        if (selectedKeys.size === 0) return
        if (action === 'delete' && !confirm(`Are you sure you want to delete ${selectedKeys.size} selected keys? This cannot be undone.`)) return
        if (action === 'assignAgent' && !confirm(`Assign agent "${bulkAgent}" to ${selectedKeys.size} selected key${selectedKeys.size !== 1 ? 's' : ''}?`)) return

        setBulkActionLoading(true)
        try {
            const promises = Array.from(selectedKeys).map(id => {
                if (action === 'delete') {
                    return fetch(`/api/admin/api-keys?id=${id}`, { method: 'DELETE' })
                } else {
                    const body: any = { id }
                    if (action === 'enable') body.isActive = true
                    if (action === 'disable') body.isActive = false
                    if (action === 'clearErrors') body.clearError = true
                    if (action === 'assignAgent') body.assignedAgent = bulkAgent
                    return fetch('/api/admin/api-keys', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                    })
                }
            })
            await Promise.all(promises)

            // Reload keys list
            const freshKeys = await fetch('/api/admin/api-keys').then(r => r.json())
            setApiKeys(freshKeys)
            setSelectedKeys(new Set())
        } catch { alert('Bulk action failed') }
        finally { setBulkActionLoading(false) }
    }

    useEffect(() => {
        fetch('/api/admin/settings')
            .then(r => r.json())
            .then(data => {
                let social: SocialLinks = { youtube: '', instagram: '', tiktok: '', x: '', imdb: '' }
                try { social = { ...social, ...JSON.parse(data.socialLinks || '{}') } } catch { /* */ }
                setSettings({
                    ...data,
                    socialLinks: social,
                    logoUrl: data.logoUrl || '',
                    geminiApiKey: data.geminiApiKey || '',
                    aiCustomPrompt: data.aiCustomPrompt || '',
                    notifyEmail: data.notifyEmail || '',
                    contactEmail: data.contactEmail || '',
                    contactPhone: data.contactPhone || '',
                    address: data.address || '',
                    // OAuth — normalize null to empty string
                    googleClientId: data.googleClientId || '',
                    googleClientSecret: data.googleClientSecret || '',
                    appleClientId: data.appleClientId || '',
                    appleTeamId: data.appleTeamId || '',
                    appleKeyId: data.appleKeyId || '',
                    applePrivateKey: data.applePrivateKey || '',
                    // Email — normalize null to defaults
                    smtpHost: data.smtpHost || '',
                    smtpPort: data.smtpPort ?? 587,
                    smtpUser: data.smtpUser || '',
                    smtpPass: data.smtpPass || '',
                    smtpFromName: data.smtpFromName || '',
                    smtpFromEmail: data.smtpFromEmail || '',
                    smtpSecure: data.smtpSecure ?? false,
                    emailsEnabled: data.emailsEnabled ?? false,
                    emailTransport: data.emailTransport || 'graph',
                    emailReplyTo: data.emailReplyTo || '',
                    notifyOnNewRole: data.notifyOnNewRole ?? true,
                    notifyOnAnnouncement: data.notifyOnAnnouncement ?? true,
                    notifyOnContentPublish: data.notifyOnContentPublish ?? true,
                    aboutPageData: data.aboutPageData || '',
                })
                setDirty(false)
            })
            .catch(() => setError('Failed to load settings'))
            .finally(() => setLoading(false))
    }, [])

    // Load API keys / admin list when switching to those tabs
    useEffect(() => {
        if (tab === 'apikeys') {
            setKeysLoading(true)
            fetch('/api/admin/api-keys')
                .then(r => r.json())
                .then(data => { if (Array.isArray(data)) setApiKeys(data) })
                .catch(() => { /* */ })
                .finally(() => setKeysLoading(false))
        }
        if (tab === 'security') {
            loadAdmins()
        }
    }, [tab])

    const loadAdmins = async () => {
        setAdminsLoading(true)
        try {
            const res = await fetch('/api/admin/manage')
            const data = await res.json()
            if (data.admins) setAdminList(data.admins)
        } catch { /* */ }
        finally { setAdminsLoading(false) }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true); setError(''); setSaved(false)
        try {
            const body = { ...settings, socialLinks: JSON.stringify(settings.socialLinks) }
            const res = await fetch('/api/admin/settings', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            })
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.details || errData.error || `Save failed (${res.status})`)
            }
            setSaved(true); setDirty(false)
            // Bust the SiteSettings cache so Navbar and other consumers reload
            // the new brand name / logo / section visibility immediately
            try { localStorage.removeItem('aim_site_settings_v1') } catch { /* */ }
            setTimeout(() => setSaved(false), 3000)
        } catch (err) { setError(err instanceof Error ? err.message : 'Failed to save settings') }
        finally { setSaving(false) }
    }

    const handlePasswordChange = async () => {
        if (!currentPassword) { setPwMsg('Current password is required'); return }
        if (newPassword.length < 6) { setPwMsg('Password must be at least 6 characters'); return }
        if (newPassword !== confirmPassword) { setPwMsg('Passwords do not match'); return }
        setPwSaving(true); setPwMsg('')
        try {
            const res = await fetch('/api/admin/manage', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword }),
            })
            const data = await res.json()
            if (!res.ok) { setPwMsg(data.error || 'Failed to update password'); return }
            setPwMsg('✓ Password updated successfully')
            setNewPassword(''); setConfirmPassword(''); setCurrentPassword('')
        } catch { setPwMsg('Failed to update password') }
        finally { setPwSaving(false) }
    }

    const handleNameChange = async () => {
        if (!newDisplayName.trim()) return
        setNameSaving(true); setNameMsg('')
        try {
            const res = await fetch('/api/admin/manage', {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newDisplayName }),
            })
            const data = await res.json()
            if (!res.ok) { setNameMsg(data.error || 'Failed'); return }
            setNameMsg('✓ Name updated')
            setNewDisplayName('')
        } catch { setNameMsg('Failed to update name') }
        finally { setNameSaving(false) }
    }

    const handleCreateAdmin = async () => {
        if (!newAdminName.trim() || !newAdminEmail.trim() || !newAdminPassword) {
            setCreateAdminMsg('All fields are required'); return
        }
        if (newAdminPassword.length < 6) { setCreateAdminMsg('Password must be at least 6 characters'); return }
        setCreateAdminSaving(true); setCreateAdminMsg('')
        try {
            const res = await fetch('/api/admin/manage', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newAdminName, email: newAdminEmail, password: newAdminPassword }),
            })
            const data = await res.json()
            if (!res.ok) { setCreateAdminMsg(data.error || 'Failed'); return }
            setCreateAdminMsg('✓ ' + data.message)
            setNewAdminName(''); setNewAdminEmail(''); setNewAdminPassword('')
            loadAdmins()
        } catch { setCreateAdminMsg('Failed to create admin') }
        finally { setCreateAdminSaving(false) }
    }

    const handleDemoteAdmin = async (userId: string, name: string) => {
        if (!confirm(`Demote "${name}" to member?`)) return
        try {
            const res = await fetch('/api/admin/manage', {
                method: 'DELETE', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            })
            const data = await res.json()
            if (!res.ok) { alert(data.error || 'Failed'); return }
            loadAdmins()
        } catch { alert('Failed to demote admin') }
    }

    const update = (field: keyof Settings, value: unknown) => {
        setSettings(s => ({ ...s, [field]: value }))
        setDirty(true)
        // Auto-save boolean toggles immediately so they persist on refresh
        if (typeof value === 'boolean') {
            autoSaveBoolean(field, value)
        }
    }

    // Warn admin before closing tab / navigating away with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!dirty) return
            e.preventDefault()
            // Modern browsers show their own generic message; setting returnValue
            // triggers the prompt in all major browsers.
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [dirty])

    const autoSaveBoolean = async (field: keyof Settings, value: boolean) => {
        try {
            const currentSettings = await fetch('/api/admin/settings').then(r => r.json())
            const body = {
                ...currentSettings,
                socialLinks: typeof currentSettings.socialLinks === 'string'
                    ? currentSettings.socialLinks
                    : JSON.stringify(currentSettings.socialLinks || {}),
                [field]: value,
            }
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            // Only clear dirty flag when the value was successfully persisted
            if (res.ok) setDirty(false)
        } catch (e) {
            console.warn('Auto-save failed for', field, e)
            // dirty stays true — value was not persisted, warn on navigation is correct
        }
    }

    const updateSocial = (key: string, value: string) => {
        setSettings(s => ({ ...s, socialLinks: { ...s.socialLinks, [key]: value } }))
        setDirty(true)
    }

    /* ── Toggle Component ── */
    const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0' }}>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{label}</span>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                style={{
                    width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                    background: checked ? 'var(--accent-gold)' : 'var(--bg-tertiary)',
                    position: 'relative', transition: 'background 0.2s',
                }}
            >
                <span style={{
                    position: 'absolute', top: '2px', left: checked ? '22px' : '2px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: checked ? 'var(--bg-primary)' : 'var(--text-tertiary)',
                    transition: 'left 0.2s, background 0.2s',
                }} />
            </button>
        </div>
    )

    return (
        <div className="admin-layout">
            <AdminSidebar />

            {/* Main */}
            <main className="admin-main">
                <div className="admin-header">
                    <h1 className="admin-page-title">Settings</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        {saved && (
                            <span style={{
                                color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600,
                                background: 'rgba(52,211,153,0.1)', padding: '0.4rem 0.8rem',
                                borderRadius: 'var(--radius-full)', border: '1px solid rgba(52,211,153,0.25)',
                            }}>✓ Saved</span>
                        )}
                        {error && (
                            <span style={{
                                color: 'var(--error)', fontSize: '0.8rem', fontWeight: 600,
                                background: 'rgba(239,68,68,0.1)', padding: '0.4rem 0.8rem',
                                borderRadius: 'var(--radius-full)', border: '1px solid rgba(239,68,68,0.25)',
                            }}>✗ {error}</span>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto var(--space-md)' }} />
                        Loading settings…
                    </div>
                ) : (
                    <div className="settings-content-layout">
                        {/* Tab sidebar */}
                        <div style={{ minWidth: '200px', flexShrink: 0 }}>
                            <nav style={{ position: 'sticky', top: 'var(--space-xl)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                {TABS.map(t => (
                                    <button key={t.key} type="button" onClick={() => setTab(t.key)}
                                        style={{
                                            textAlign: 'left', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-md)',
                                            border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
                                            background: tab === t.key ? 'var(--accent-gold-glow)' : 'transparent',
                                            color: tab === t.key ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                            borderLeft: tab === t.key ? '2px solid var(--accent-gold)' : '2px solid transparent',
                                            transition: 'all 0.15s',
                                        }}
                                    >{t.label}</button>
                                ))}
                            </nav>
                        </div>

                        {/* Tab content */}
                        <form onSubmit={handleSubmit} style={{ flex: 1, maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>

                            {/* ─── General ─── */}
                            {tab === 'general' && (
                                <section className="admin-form-section">
                                    <h3 className="admin-form-section-title">🏷️ Brand Identity</h3>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
                                        Define your studio brand. These values appear across the site: header, SEO meta, social sharing, and footer.
                                    </p>

                                    {/* Live Brand Preview */}
                                    <div style={{
                                        padding: 'var(--space-lg)', marginBottom: 'var(--space-xl)',
                                        background: 'linear-gradient(135deg, rgba(212,168,83,0.06), rgba(59,130,246,0.03))',
                                        border: '1px solid rgba(212,168,83,0.12)', borderRadius: 'var(--radius-lg)',
                                    }}>
                                        <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent-gold)', marginBottom: 'var(--space-md)' }}>Live Preview</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: '6px' }}>
                                            {settings.logoUrl && <img src={settings.logoUrl} alt="" style={{ width: 32, height: 32, borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--border-subtle)' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                                            <div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-display)' }}>
                                                    <span style={{ color: 'var(--accent-gold)' }}>{settings.siteName?.split(' ')[0] || 'AIM'}</span>{' '}{settings.siteName?.split(' ').slice(1).join(' ') || 'Studio'}
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{settings.tagline || 'Your tagline here'}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="admin-form-grid">
                                        <div>
                                            <label className="admin-label">Site Name</label>
                                            <input className="admin-input" value={settings.siteName} onChange={e => update('siteName', e.target.value)} />
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '3px' }}>Appears in header, tab title, and social cards</div>
                                        </div>
                                        <div>
                                            <label className="admin-label">Tagline</label>
                                            <input className="admin-input" value={settings.tagline} onChange={e => update('tagline', e.target.value)} />
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '3px' }}>Short brand descriptor for SEO and homepage</div>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 'var(--space-lg)' }}>
                                        <label className="admin-label">Site Logo</label>
                                        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-start' }}>
                                            {/* Preview box */}
                                            <div style={{
                                                width: 72, height: 72, flexShrink: 0, borderRadius: 'var(--radius-md)',
                                                border: '2px dashed var(--border-subtle)', overflow: 'hidden',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                background: 'rgba(255,255,255,0.02)', fontSize: '1.6rem',
                                            }}>
                                                {settings.logoUrl
                                                    ? <img src={settings.logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                                                    : '🖼️'}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                {/* Upload button */}
                                                <label style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                    padding: '7px 14px', borderRadius: 'var(--radius-md)',
                                                    background: 'rgba(212,168,83,0.12)', border: '1px solid rgba(212,168,83,0.25)',
                                                    color: 'var(--accent-gold)', fontSize: '0.8rem', fontWeight: 600,
                                                    cursor: 'pointer', marginBottom: '8px',
                                                }}>
                                                    📁 Upload Logo
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        style={{ display: 'none' }}
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0]
                                                            if (!file) return
                                                            const fd = new FormData()
                                                            fd.append('file', file)
                                                            fd.append('category', 'logo')
                                                            const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
                                                            if (res.ok) {
                                                                const data = await res.json()
                                                                update('logoUrl', data.url)
                                                            } else {
                                                                alert('Upload failed. Please try again.')
                                                            }
                                                        }}
                                                    />
                                                </label>
                                                {/* Remove logo button — only shown when a logo is set */}
                                                {settings.logoUrl && (
                                                    <button
                                                        type="button"
                                                        onClick={() => update('logoUrl', '')}
                                                        style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                            padding: '7px 12px', borderRadius: 'var(--radius-md)',
                                                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                                                            color: '#ef4444', fontSize: '0.78rem', fontWeight: 600,
                                                            cursor: 'pointer', marginBottom: '8px', marginLeft: '6px',
                                                        }}
                                                    >
                                                        ✕ Remove Logo
                                                    </button>
                                                )}
                                                {/* URL fallback */}
                                                <input
                                                    className="admin-input"
                                                    value={settings.logoUrl}
                                                    onChange={e => update('logoUrl', e.target.value)}
                                                    placeholder="Or paste a URL — https://... or /images/logo.png"
                                                />
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                                                    Recommended: square PNG or SVG, min 256×256px.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* ─── About & Mission ─── */}
                            {tab === 'about' && (() => {
                                let apd: AboutPageData = { ...EMPTY_ABOUT }
                                try { if (settings.aboutPageData) apd = { ...EMPTY_ABOUT, ...JSON.parse(settings.aboutPageData) } } catch { /* */ }
                                const ua = (key: keyof AboutPageData, val: string | number) => {
                                    const next = { ...apd, [key]: val }
                                    update('aboutPageData', JSON.stringify(next))
                                }
                                const hintStyle = { fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: '3px' } as const
                                const sectionHeader = (emoji: string, title: string, desc: string) => (
                                    <>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '4px', marginTop: 'var(--space-xl)' }}>{emoji} {title}</div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)', lineHeight: 1.5 }}>{desc}</div>
                                    </>
                                )
                                return (
                                    <section className="admin-form-section">
                                        <h3 className="admin-form-section-title">📖 About Page Content</h3>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)', lineHeight: 1.6 }}>
                                            Edit every section of the About page. <strong style={{ color: 'var(--text-secondary)' }}>Leave fields empty to use locale translations.</strong>
                                        </p>

                                        {/* ── Mission & Story (existing fields) ── */}
                                        {sectionHeader('🎯', 'Mission & Story', 'Core narrative shown in the Mission and Story cards.')}
                                        <div className="admin-form-stack">
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <label className="admin-label">About Text <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(elevator pitch)</span></label>
                                                    <span style={{ fontSize: '0.6rem', color: settings.aboutText.length > 300 ? '#f59e0b' : 'var(--text-tertiary)' }}>{settings.aboutText.length}/300 recommended</span>
                                                </div>
                                                <textarea className="admin-textarea" rows={3} value={settings.aboutText} onChange={e => update('aboutText', e.target.value)} placeholder="Leave empty to use translation" />
                                            </div>
                                            <div>
                                                <label className="admin-label">Studio Story <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(origin narrative)</span></label>
                                                <textarea className="admin-textarea" rows={4} value={settings.studioStory} onChange={e => update('studioStory', e.target.value)} placeholder="Leave empty to use translation" />
                                            </div>
                                            <div style={{ padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)', background: 'linear-gradient(135deg, rgba(168,85,247,0.04), rgba(59,130,246,0.03))', border: '1px solid rgba(168,85,247,0.1)' }}>
                                                <label className="admin-label" style={{ margin: 0, marginBottom: '6px' }}>Mission Statement</label>
                                                <textarea className="admin-textarea" rows={3} value={settings.mission} onChange={e => update('mission', e.target.value)} placeholder="Leave empty to use translation" />
                                                <div style={hintStyle}>Displayed in the Mission card on the About page.</div>
                                            </div>
                                        </div>

                                        {/* ── Hero ── */}
                                        {sectionHeader('🎬', 'Hero Section', 'The subtitle shown below the main heading.')}
                                        <div>
                                            <label className="admin-label">Hero Subtitle</label>
                                            <textarea className="admin-textarea" rows={2} value={apd.heroSubtitle} onChange={e => ua('heroSubtitle', e.target.value)} placeholder="Leave empty to use translation" />
                                            <div style={hintStyle}>Appears below the page title on the About page.</div>
                                        </div>

                                        {/* ── Stats ── */}
                                        {sectionHeader('📊', 'Stats Bar', 'Four counters shown below the hero. Set value to 0 to use defaults.')}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            {([['stat1', 'e.g. Productions', 12], ['stat2', 'e.g. Countries', 30], ['stat3', 'e.g. Members', 500], ['stat4', 'e.g. Active Projects', 8]] as const).map(([prefix, ph, def]) => (
                                                <div key={prefix} style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
                                                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                                                        <div style={{ flex: '0 0 60px' }}>
                                                            <label className="admin-label" style={{ fontSize: '0.6rem' }}>Value</label>
                                                            <input className="admin-input" type="number" value={apd[`${prefix}Value` as keyof AboutPageData] as number || ''} onChange={e => ua(`${prefix}Value` as keyof AboutPageData, parseInt(e.target.value) || 0)} placeholder={String(def)} style={{ fontSize: '0.78rem' }} />
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <label className="admin-label" style={{ fontSize: '0.6rem' }}>Label</label>
                                                            <input className="admin-input" value={apd[`${prefix}Label` as keyof AboutPageData] as string} onChange={e => ua(`${prefix}Label` as keyof AboutPageData, e.target.value)} placeholder={ph} style={{ fontSize: '0.78rem' }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* ── Philosophy ── */}
                                        {sectionHeader('💡', 'Philosophy Quote', 'Inspirational quote displayed between sections.')}
                                        <div className="admin-form-stack">
                                            <div>
                                                <label className="admin-label">Quote</label>
                                                <textarea className="admin-textarea" rows={2} value={apd.philosophyQuote} onChange={e => ua('philosophyQuote', e.target.value)} placeholder="Leave empty to use translation" />
                                            </div>
                                            <div className="admin-form-grid">
                                                <div>
                                                    <label className="admin-label">Author Name</label>
                                                    <input className="admin-input" value={apd.philosophyAuthor} onChange={e => ua('philosophyAuthor', e.target.value)} placeholder="Leave empty to use translation" />
                                                </div>
                                                <div>
                                                    <label className="admin-label">Author Role</label>
                                                    <input className="admin-input" value={apd.philosophyRole} onChange={e => ua('philosophyRole', e.target.value)} placeholder="Leave empty to use translation" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── Timeline ── */}
                                        {sectionHeader('🗓️', 'Journey Timeline', 'Three milestones shown on the timeline.')}
                                        {([1, 2, 3] as const).map(n => (
                                            <div key={n} style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', marginBottom: '8px' }}>
                                                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Milestone {n}</div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '6px', marginBottom: '6px' }}>
                                                    <div>
                                                        <label className="admin-label" style={{ fontSize: '0.58rem' }}>Year</label>
                                                        <input className="admin-input" value={apd[`milestone${n}Year` as keyof AboutPageData] as string} onChange={e => ua(`milestone${n}Year` as keyof AboutPageData, e.target.value)} placeholder="2025" style={{ fontSize: '0.78rem' }} />
                                                    </div>
                                                    <div>
                                                        <label className="admin-label" style={{ fontSize: '0.58rem' }}>Title</label>
                                                        <input className="admin-input" value={apd[`milestone${n}Title` as keyof AboutPageData] as string} onChange={e => ua(`milestone${n}Title` as keyof AboutPageData, e.target.value)} placeholder="Leave empty to use translation" style={{ fontSize: '0.78rem' }} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="admin-label" style={{ fontSize: '0.58rem' }}>Description</label>
                                                    <textarea className="admin-textarea" rows={2} value={apd[`milestone${n}Desc` as keyof AboutPageData] as string} onChange={e => ua(`milestone${n}Desc` as keyof AboutPageData, e.target.value)} placeholder="Leave empty to use translation" style={{ fontSize: '0.78rem' }} />
                                                </div>
                                            </div>
                                        ))}

                                        {/* ── Values ── */}
                                        {sectionHeader('⭐', 'Value Cards', 'Three value cards displayed in a grid.')}
                                        {([['value1', 'Showcase'], ['value2', 'Community'], ['value3', 'Open Doors']] as const).map(([prefix, defaultTitle]) => (
                                            <div key={prefix} style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', marginBottom: '8px' }}>
                                                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{defaultTitle}</div>
                                                <div className="admin-form-grid" style={{ marginBottom: '6px' }}>
                                                    <div>
                                                        <label className="admin-label" style={{ fontSize: '0.58rem' }}>Title</label>
                                                        <input className="admin-input" value={apd[`${prefix}Title` as keyof AboutPageData] as string} onChange={e => ua(`${prefix}Title` as keyof AboutPageData, e.target.value)} placeholder="Leave empty to use translation" style={{ fontSize: '0.78rem' }} />
                                                    </div>
                                                    <div>
                                                        <label className="admin-label" style={{ fontSize: '0.58rem' }}>Subtitle</label>
                                                        <input className="admin-input" value={apd[`${prefix}Sub` as keyof AboutPageData] as string} onChange={e => ua(`${prefix}Sub` as keyof AboutPageData, e.target.value)} placeholder="Leave empty to use translation" style={{ fontSize: '0.78rem' }} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="admin-label" style={{ fontSize: '0.58rem' }}>Description</label>
                                                    <textarea className="admin-textarea" rows={2} value={apd[`${prefix}Desc` as keyof AboutPageData] as string} onChange={e => ua(`${prefix}Desc` as keyof AboutPageData, e.target.value)} placeholder="Leave empty to use translation" style={{ fontSize: '0.78rem' }} />
                                                </div>
                                            </div>
                                        ))}

                                        {/* ── CTA ── */}
                                        {sectionHeader('🚀', 'Call to Action', 'Bottom section with heading and buttons.')}
                                        <div className="admin-form-stack">
                                            <div className="admin-form-grid">
                                                <div>
                                                    <label className="admin-label">CTA Title</label>
                                                    <input className="admin-input" value={apd.ctaTitle} onChange={e => ua('ctaTitle', e.target.value)} placeholder="Leave empty to use translation" />
                                                </div>
                                                <div>
                                                    <label className="admin-label">Title Accent (gold text)</label>
                                                    <input className="admin-input" value={apd.ctaTitleAccent} onChange={e => ua('ctaTitleAccent', e.target.value)} placeholder="Leave empty to use translation" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="admin-label">CTA Description</label>
                                                <textarea className="admin-textarea" rows={2} value={apd.ctaDesc} onChange={e => ua('ctaDesc', e.target.value)} placeholder="Leave empty to use translation" />
                                            </div>
                                            <div className="admin-form-grid">
                                                <div>
                                                    <label className="admin-label">Primary Button Text</label>
                                                    <input className="admin-input" value={apd.ctaButtonText} onChange={e => ua('ctaButtonText', e.target.value)} placeholder="Leave empty to use translation" />
                                                </div>
                                                <div>
                                                    <label className="admin-label">Secondary Button Text</label>
                                                    <input className="admin-input" value={apd.ctaSecondaryText} onChange={e => ua('ctaSecondaryText', e.target.value)} placeholder="Leave empty to use translation" />
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                )
                            })()}

                            {/* ─── Contact & Social ─── */}
                            {tab === 'contact' && (
                                <>
                                    <section className="admin-form-section">
                                        <h3 className="admin-form-section-title">📭 Contact Information</h3>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
                                            Public contact details shown on the website footer, contact page, and press materials.
                                        </p>
                                        {/* Completion indicator */}
                                        <div style={{
                                            display: 'flex', gap: '4px', marginBottom: 'var(--space-lg)',
                                        }}>
                                            {[
                                                { label: 'Email', filled: !!settings.contactEmail },
                                                { label: 'Phone', filled: !!settings.contactPhone },
                                                { label: 'Address', filled: !!settings.address },
                                            ].map(f => (
                                                <div key={f.label} style={{
                                                    flex: 1, padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                                                    background: f.filled ? 'rgba(52,211,153,0.06)' : 'rgba(239,68,68,0.04)',
                                                    border: `1px solid ${f.filled ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.1)'}`,
                                                    textAlign: 'center', fontSize: '0.62rem', fontWeight: 600,
                                                    color: f.filled ? '#34d399' : 'var(--text-tertiary)',
                                                }}>{f.filled ? '✓' : '○'} {f.label}</div>
                                            ))}
                                        </div>
                                        <div className="admin-form-grid">
                                            <div>
                                                <label className="admin-label">✉️ Email</label>
                                                <input className="admin-input" type="email" value={settings.contactEmail} onChange={e => update('contactEmail', e.target.value)} placeholder="studio@aim.com" />
                                            </div>
                                            <div>
                                                <label className="admin-label">📞 Phone</label>
                                                <input className="admin-input" type="tel" value={settings.contactPhone} onChange={e => update('contactPhone', e.target.value)} placeholder="+1 (555) 000-0000" />
                                            </div>
                                        </div>
                                        <div style={{ marginTop: 'var(--space-lg)' }}>
                                            <label className="admin-label">📍 Address</label>
                                            <input className="admin-input" value={settings.address} onChange={e => update('address', e.target.value)} placeholder="123 Studio Way, Los Angeles, CA" />
                                        </div>
                                    </section>
                                    <section className="admin-form-section">
                                        <h3 className="admin-form-section-title">🌐 Social Presence</h3>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
                                            Link your social platforms. Icons appear in the site footer and about page.
                                        </p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            {[
                                                { key: 'youtube', label: 'YouTube', icon: '▶', color: '#ff0000', ph: 'https://youtube.com/@channel' },
                                                { key: 'instagram', label: 'Instagram', icon: '📷', color: '#e1306c', ph: 'https://instagram.com/handle' },
                                                { key: 'tiktok', label: 'TikTok', icon: '🎵', color: '#00f2ea', ph: 'https://tiktok.com/@handle' },
                                                { key: 'x', label: 'X (Twitter)', icon: '𝕏', color: '#1da1f2', ph: 'https://x.com/handle' },
                                            ].map(p => {
                                                const val = settings.socialLinks[p.key as keyof SocialLinks] || ''
                                                return (
                                                    <div key={p.key} style={{
                                                        padding: '10px 12px', borderRadius: 'var(--radius-md)',
                                                        background: val ? `${p.color}08` : 'var(--bg-primary)',
                                                        border: `1px solid ${val ? `${p.color}20` : 'var(--border-subtle)'}`,
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                            <span style={{ fontSize: '0.9rem' }}>{p.icon}</span>
                                                            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: val ? p.color : 'var(--text-tertiary)' }}>{p.label}</span>
                                                            {val && <span style={{ fontSize: '0.5rem', color: '#34d399', fontWeight: 700 }}>✓ LINKED</span>}
                                                        </div>
                                                        <input className="admin-input" value={val} onChange={e => updateSocial(p.key, e.target.value)}
                                                            placeholder={p.ph} style={{ fontSize: '0.72rem' }} />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        {/* IMDb full width */}
                                        <div style={{
                                            marginTop: '8px', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                                            background: settings.socialLinks.imdb ? 'rgba(245,197,24,0.04)' : 'var(--bg-primary)',
                                            border: `1px solid ${settings.socialLinks.imdb ? 'rgba(245,197,24,0.15)' : 'var(--border-subtle)'}`,
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '0.9rem' }}>🎬</span>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: settings.socialLinks.imdb ? '#f5c518' : 'var(--text-tertiary)' }}>IMDb</span>
                                                {settings.socialLinks.imdb && <span style={{ fontSize: '0.5rem', color: '#34d399', fontWeight: 700 }}>✓ LINKED</span>}
                                            </div>
                                            <input className="admin-input" value={settings.socialLinks.imdb || ''} onChange={e => updateSocial('imdb', e.target.value)}
                                                placeholder="https://imdb.com/name/..." style={{ fontSize: '0.72rem' }} />
                                        </div>
                                    </section>
                                </>
                            )}

                            {/* ─── API Keys & Agents (Unified) ─── */}
                            {tab === 'apikeys' && (
                                <section className="admin-form-section">
                                    <h3 className="admin-form-section-title">🔑 API Keys & AI Agent Configuration</h3>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
                                        Manage API keys and configure AI agents. Each key can be assigned to a specific agent or shared. Keys auto-rotate on rate limits.
                                    </p>

                                    {/* ── Agent Configuration Cards ── */}
                                    <div style={{
                                        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-md)',
                                        marginBottom: 'var(--space-xl)',
                                    }}>
                                        {[
                                            {
                                                id: 'audition', icon: '🎭', title: 'Audition Agent',
                                                desc: 'Reviews casting applications and generates fit reports',
                                                keyCount: apiKeys.filter(k => k.isActive && (k.assignedAgent === 'audition' || k.assignedAgent === 'all')).length,
                                                color: '#f59e0b',
                                            },
                                            {
                                                id: 'analytics', icon: '📊', title: 'Analytics Agent',
                                                desc: 'Generates traffic and engagement insights',
                                                keyCount: apiKeys.filter(k => k.isActive && (k.assignedAgent === 'analytics' || k.assignedAgent === 'all')).length,
                                                color: '#3b82f6',
                                            },
                                            {
                                                id: 'scripts', icon: '✍️', title: 'Script Agent',
                                                desc: 'Analyzes screenplay submissions',
                                                keyCount: apiKeys.filter(k => k.isActive && (k.assignedAgent === 'scripts' || k.assignedAgent === 'all')).length,
                                                color: '#10b981',
                                            },
                                            {
                                                id: 'training', icon: '📚', title: 'Training Agent',
                                                desc: 'Generates lessons, quizzes, and review guidance',
                                                keyCount: apiKeys.filter(k => k.isActive && (k.assignedAgent === 'training' || k.assignedAgent === 'all')).length,
                                                color: '#a855f7',
                                            },
                                        ].map(agent => (
                                            <div key={agent.id} style={{
                                                padding: 'var(--space-md)',
                                                borderRadius: 'var(--radius-lg)',
                                                background: `linear-gradient(135deg, ${agent.color}08, ${agent.color}03)`,
                                                border: `1px solid ${agent.color}20`,
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                                    <span style={{ fontSize: '1.1rem' }}>{agent.icon}</span>
                                                    <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{agent.title}</span>
                                                </div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: '8px' }}>{agent.desc}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{
                                                        fontSize: '0.6rem', padding: '2px 8px', borderRadius: 'var(--radius-full)',
                                                        background: agent.keyCount > 0 ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.08)',
                                                        color: agent.keyCount > 0 ? '#34d399' : '#ef4444',
                                                        fontWeight: 700,
                                                    }}>
                                                        {agent.keyCount > 0 ? `${agent.keyCount} key${agent.keyCount > 1 ? 's' : ''} active` : 'No keys'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* ── AI Model & Prompt Config ── */}
                                    <div style={{
                                        padding: 'var(--space-lg)',
                                        background: 'rgba(139,92,246,0.03)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid rgba(139,92,246,0.1)',
                                        marginBottom: 'var(--space-xl)',
                                    }}>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a855f7', marginBottom: 'var(--space-md)' }}>
                                            🤖 Audition Agent Config
                                        </div>
                                        <div className="admin-form-grid" style={{ marginBottom: 'var(--space-md)' }}>
                                            <div>
                                                <label className="admin-label">AI Model</label>
                                                <select className="admin-input" value={settings.aiModel} onChange={e => update('aiModel', e.target.value)}
                                                    style={{ cursor: 'pointer', appearance: 'auto' }}>
                                                    {AI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
                                                <Toggle checked={settings.aiAutoAudit} onChange={v => update('aiAutoAudit', v)} label="Auto-run AI audit on new applications" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="admin-label">Custom Prompt Instructions <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(optional)</span></label>
                                            <textarea className="admin-textarea" rows={3} value={settings.aiCustomPrompt} onChange={e => update('aiCustomPrompt', e.target.value)}
                                                placeholder="e.g. Weight passion and potential higher than formal training. We value diversity and fresh perspectives." />
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                                Appended to the AI casting director prompt for audition analysis.
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── Add New Key ── */}
                                    <div style={{
                                        padding: 'var(--space-lg)',
                                        background: 'var(--bg-primary)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: '1px solid var(--border-subtle)',
                                        marginBottom: 'var(--space-lg)',
                                    }}>
                                        <div style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--accent-gold)', marginBottom: 'var(--space-md)' }}>
                                            + Add New API Key
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                                            <div>
                                                <label className="admin-label">Provider</label>
                                                <select
                                                    className="admin-input"
                                                    value={newKeyProvider}
                                                    onChange={e => setNewKeyProvider(e.target.value)}
                                                    style={{ cursor: 'pointer', appearance: 'auto' }}
                                                >
                                                    <option value="gemini">🔷 Google Gemini</option>
                                                    <option value="groq">⚡ Groq</option>
                                                    <option value="openai">🟢 OpenAI</option>
                                                    <option value="elevenlabs">🎙️ ElevenLabs (TTS)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="admin-label">Assign to Agent</label>
                                                <select
                                                    className="admin-input"
                                                    value={newKeyAgent}
                                                    onChange={e => setNewKeyAgent(e.target.value)}
                                                    style={{ cursor: 'pointer', appearance: 'auto' }}
                                                >
                                                    <option value="all">🌐 All Agents</option>
                                                    <option value="audition">🎭 Audition</option>
                                                    <option value="analytics">📊 Analytics</option>
                                                    <option value="scripts">✍️ Scripts</option>
                                                    <option value="training">📚 Training</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="admin-label">Label</label>
                                                <input
                                                    className="admin-input"
                                                    placeholder={newKeyProvider === 'groq' ? 'e.g., Groq Main' : 'e.g., Gemini Key'}
                                                    value={newKeyLabel}
                                                    onChange={e => setNewKeyLabel(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end' }}>
                                            <div style={{ flex: 1 }}>
                                                <label className="admin-label">API Key *</label>
                                                <input
                                                    className="admin-input"
                                                    type="password"
                                                    placeholder={newKeyProvider === 'groq' ? 'gsk_...' : 'Paste your API key'}
                                                    value={newKeyValue}
                                                    onChange={e => setNewKeyValue(e.target.value)}
                                                />
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                                                    {newKeyProvider === 'groq'
                                                        ? <>Get a free key from <span style={{ color: 'var(--accent-gold)' }}>console.groq.com/keys</span></>
                                                        : newKeyProvider === 'gemini'
                                                            ? <>Get a key from <span style={{ color: 'var(--accent-gold)' }}>aistudio.google.com</span></>
                                                            : <>Get a key from <span style={{ color: 'var(--accent-gold)' }}>platform.openai.com</span></>
                                                    }
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={!newKeyValue || keysLoading}
                                                onClick={async () => {
                                                    setKeysLoading(true)
                                                    try {
                                                        const res = await fetch('/api/admin/api-keys', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                label: newKeyLabel || `${newKeyProvider.charAt(0).toUpperCase() + newKeyProvider.slice(1)} Key`,
                                                                key: newKeyValue,
                                                                provider: newKeyProvider,
                                                                assignedAgent: newKeyAgent,
                                                            }),
                                                        })
                                                        if (res.ok) {
                                                            const key = await res.json()
                                                            setApiKeys(prev => [key, ...prev])
                                                            setNewKeyLabel('')
                                                            setNewKeyValue('')
                                                            if (apiKeys.length === 0) {
                                                                update('geminiApiKey', newKeyValue)
                                                            }
                                                        }
                                                    } catch { /* */ }
                                                    finally { setKeysLoading(false) }
                                                }}
                                                className="btn btn-primary btn-sm"
                                                style={{ opacity: newKeyValue ? 1 : 0.4, whiteSpace: 'nowrap', flexShrink: 0 }}
                                            >
                                                {keysLoading ? '⏳ Adding...' : '+ Add Key'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* ── Key List ── */}
                                    {apiKeys.length === 0 && !keysLoading && (
                                        <div style={{
                                            textAlign: 'center', padding: 'var(--space-2xl)',
                                            color: 'var(--text-tertiary)', fontSize: '0.85rem',
                                        }}>
                                            No API keys configured yet. Add one above to enable AI features.
                                        </div>
                                    )}

                                    {(() => {
                                        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
                                        let filteredKeys = apiKeys.filter(k => {
                                            if (keyFilterProvider !== 'all' && k.provider !== keyFilterProvider) return false
                                            // 'all_agents' = only keys assigned to the pool (assignedAgent === 'all')
                                            if (keyFilterAgent === 'all_agents' && k.assignedAgent !== 'all') return false
                                            // specific agent filter — match exact agent name (excluding 'all' and 'all_agents')
                                            if (keyFilterAgent !== 'all' && keyFilterAgent !== 'all_agents' && k.assignedAgent !== keyFilterAgent) return false
                                            if (keyFilterStatus === 'active' && !k.isActive) return false
                                            if (keyFilterStatus === 'inactive' && k.isActive) return false
                                            if (keyFilterStatus === 'error' && !k.lastError) return false
                                            if (keyFilterStatus === 'recently-used' && (!k.lastUsed || k.lastUsed < sevenDaysAgo)) return false
                                            if (keySearch) {
                                                const s = keySearch.toLowerCase()
                                                if (!k.label.toLowerCase().includes(s) && !k.key.toLowerCase().includes(s)) return false
                                            }
                                            return true
                                        })
                                        // Sort recently-used results by lastUsed descending
                                        if (keyFilterStatus === 'recently-used') {
                                            filteredKeys = [...filteredKeys].sort((a, b) =>
                                                (b.lastUsed ?? '').localeCompare(a.lastUsed ?? '')
                                            )
                                        }

                                        const agentLabels: Record<string, { icon: string; label: string; color: string }> = {
                                            all: { icon: '🌐', label: 'All', color: 'var(--accent-gold)' },
                                            audition: { icon: '🎭', label: 'Audition', color: '#f59e0b' },
                                            analytics: { icon: '📊', label: 'Analytics', color: '#3b82f6' },
                                            scripts: { icon: '✍️', label: 'Scripts', color: '#10b981' },
                                            training: { icon: '📚', label: 'Training', color: '#a855f7' },
                                        }
                                        const providerIcons: Record<string, string> = { gemini: '🔷', groq: '⚡', openai: '🟢', elevenlabs: '🎙️' }

                                        return (
                                            <>
                                                {/* Advanced Filtering & Bulk Actions */}
                                                {apiKeys.length > 0 && (
                                                    <div style={{
                                                        padding: '12px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                                                        borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)',
                                                        display: 'flex', flexDirection: 'column', gap: '12px',
                                                    }}>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                                                            <input
                                                                className="admin-input" placeholder="🔍 Search labels or keys..."
                                                                value={keySearch} onChange={e => setKeySearch(e.target.value)}
                                                                style={{ flex: 1, minWidth: '200px' }}
                                                            />
                                                            <select className="admin-input" value={keyFilterProvider} onChange={e => setKeyFilterProvider(e.target.value)} style={{ width: 'auto' }}>
                                                                <option value="all">All Providers</option>
                                                                <option value="gemini">🔷 Gemini</option>
                                                                <option value="groq">⚡ Groq</option>
                                                                <option value="openai">🟢 OpenAI</option>
                                                                <option value="elevenlabs">🎙️ ElevenLabs</option>
                                                            </select>
                                                            <select className="admin-input" value={keyFilterAgent} onChange={e => setKeyFilterAgent(e.target.value)} style={{ width: 'auto' }}>
                                                                <option value="all">All Agents</option>
                                                                <option value="all_agents">🌐 "All" Only</option>
                                                                <option value="audition">🎭 Audition</option>
                                                                <option value="analytics">📊 Analytics</option>
                                                                <option value="scripts">✍️ Scripts</option>
                                                                <option value="training">📚 Training</option>
                                                            </select>
                                                            <select className="admin-input" value={keyFilterStatus} onChange={e => setKeyFilterStatus(e.target.value)} style={{ width: 'auto' }}>
                                                                <option value="all">Status: All</option>
                                                                <option value="active">✅ Active</option>
                                                                <option value="inactive">⏸ Inactive</option>
                                                                <option value="error">⚠️ Has Error</option>
                                                                <option value="recently-used">🕐 Recently Used (7d)</option>
                                                            </select>
                                                        </div>

                                                        {/* Bulk Action Toolbar */}
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', flexWrap: 'wrap', gap: '10px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedKeys.size > 0 && selectedKeys.size === filteredKeys.length}
                                                                        onChange={e => {
                                                                            if (e.target.checked) setSelectedKeys(new Set(filteredKeys.map(k => k.id)))
                                                                            else setSelectedKeys(new Set())
                                                                        }}
                                                                    />
                                                                    Select All
                                                                </label>
                                                                {selectedKeys.size > 0 && (
                                                                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)' }}>
                                                                        {selectedKeys.size} selected
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                                {/* ── Bulk Assign Agent ── */}
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 4px 3px 8px', borderRadius: '6px', background: 'rgba(212,168,83,0.07)', border: '1px solid rgba(212,168,83,0.18)' }}>
                                                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--accent-gold)', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>🤖 Agent:</span>
                                                                    <select
                                                                        value={bulkAgent}
                                                                        onChange={e => setBulkAgent(e.target.value)}
                                                                        style={{ padding: '2px 6px', fontSize: '0.7rem', borderRadius: '4px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none' }}
                                                                    >
                                                                        {Object.keys(agentLabels).map(key => (
                                                                            <option key={key} value={key} style={{ background: 'var(--bg-card)' }}>
                                                                                {agentLabels[key as keyof typeof agentLabels].icon} {agentLabels[key as keyof typeof agentLabels].label}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                    <button
                                                                        type="button"
                                                                        disabled={selectedKeys.size === 0 || bulkActionLoading}
                                                                        onClick={() => handleBulkAction('assignAgent')}
                                                                        style={{ padding: '3px 10px', fontSize: '0.68rem', fontWeight: 700, borderRadius: '4px', border: 'none', background: selectedKeys.size > 0 ? 'rgba(212,168,83,0.25)' : 'rgba(255,255,255,0.05)', color: selectedKeys.size > 0 ? 'var(--accent-gold)' : 'var(--text-tertiary)', cursor: selectedKeys.size > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                                                                    >
                                                                        {bulkActionLoading ? '...' : '✓ Assign'}
                                                                    </button>
                                                                </div>
                                                                {/* ── Other bulk actions ── */}
                                                                <button type="button" disabled={selectedKeys.size === 0 || bulkActionLoading} onClick={() => handleBulkAction('enable')}
                                                                    style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '4px', background: 'rgba(52,211,153,0.1)', color: 'var(--success)', border: '1px solid rgba(52,211,153,0.2)', cursor: selectedKeys.size ? 'pointer' : 'not-allowed', opacity: selectedKeys.size ? 1 : 0.5 }}>
                                                                    ▶ Enable
                                                                </button>
                                                                <button type="button" disabled={selectedKeys.size === 0 || bulkActionLoading} onClick={() => handleBulkAction('disable')}
                                                                    style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', cursor: selectedKeys.size ? 'pointer' : 'not-allowed', opacity: selectedKeys.size ? 1 : 0.5 }}>
                                                                    ⏸ Disable
                                                                </button>
                                                                <button type="button" disabled={selectedKeys.size === 0 || bulkActionLoading} onClick={() => handleBulkAction('clearErrors')}
                                                                    style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '4px', background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)', cursor: selectedKeys.size ? 'pointer' : 'not-allowed', opacity: selectedKeys.size ? 1 : 0.5 }}>
                                                                    ✨ Clear Errors
                                                                </button>
                                                                <button type="button" disabled={selectedKeys.size === 0 || bulkActionLoading} onClick={() => handleBulkAction('delete')}
                                                                    style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '4px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', cursor: selectedKeys.size ? 'pointer' : 'not-allowed', opacity: selectedKeys.size ? 1 : 0.5 }}>
                                                                    🗑 Delete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                                                        <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-tertiary)' }}>
                                                            <tr>
                                                                <th style={{ padding: '10px 14px', width: '30px' }}></th>
                                                                <th style={{ padding: '10px 0' }}>Label & Key</th>
                                                                <th style={{ padding: '10px 0' }}>Provider</th>
                                                                <th style={{ padding: '10px 0' }}>Assigned Agent</th>
                                                                <th style={{ padding: '10px 0' }}>Usage / Health</th>
                                                                <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {filteredKeys.length === 0 ? (
                                                                <tr>
                                                                    <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                                                        No keys match the current filters.
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                filteredKeys.map(k => {
                                                                    const aInfo = agentLabels[k.assignedAgent] || agentLabels.all
                                                                    return (
                                                                        <tr key={k.id} style={{
                                                                            borderBottom: '1px solid var(--border-subtle)',
                                                                            background: k.isActive ? 'transparent' : 'rgba(0,0,0,0.2)',
                                                                            opacity: k.isActive ? 1 : 0.6,
                                                                        }}>
                                                                            <td style={{ padding: '10px 14px' }}>
                                                                                <input type="checkbox" checked={selectedKeys.has(k.id)} onChange={e => {
                                                                                    const next = new Set(selectedKeys)
                                                                                    if (e.target.checked) next.add(k.id)
                                                                                    else next.delete(k.id)
                                                                                    setSelectedKeys(next)
                                                                                }} />
                                                                            </td>
                                                                            <td style={{ padding: '10px 0', minWidth: '160px' }}>
                                                                                <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{k.label}</div>
                                                                                <div style={{ fontFamily: 'monospace', color: 'var(--text-tertiary)', fontSize: '0.65rem' }}>{k.key}</div>
                                                                            </td>
                                                                            <td style={{ padding: '10px 0' }}>
                                                                                <span style={{ padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                                                                                    {providerIcons[k.provider]} <span style={{ textTransform: 'capitalize' }}>{k.provider}</span>
                                                                                </span>
                                                                            </td>
                                                                            <td style={{ padding: '10px 0' }}>
                                                                                <select
                                                                                    value={k.assignedAgent}
                                                                                    onChange={async (e) => {
                                                                                        const newAgent = e.target.value
                                                                                        const res = await fetch('/api/admin/api-keys', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id, assignedAgent: newAgent }) })
                                                                                        if (res.ok) setApiKeys(prev => prev.map(pk => pk.id === k.id ? { ...pk, assignedAgent: newAgent } : pk))
                                                                                    }}
                                                                                    style={{ padding: '2px 6px', fontSize: '0.7rem', borderRadius: '4px', border: '1px solid var(--border-subtle)', background: `${aInfo.color}15`, color: aInfo.color, fontWeight: 600, cursor: 'pointer' }}
                                                                                >
                                                                                    {Object.keys(agentLabels).map(key => <option key={key} value={key}>{agentLabels[key].icon} {agentLabels[key].label}</option>)}
                                                                                </select>
                                                                            </td>
                                                                            <td style={{ padding: '10px 0' }}>
                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                                    <div style={{ fontSize: '0.65rem' }}>
                                                                                        <strong style={{ color: 'var(--text-secondary)' }}>{k.usageCount}</strong> calls {k.lastUsed ? `• Last used ${new Date(k.lastUsed).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '✨ Never used'}
                                                                                    </div>
                                                                                    {(() => {
                                                                                        const now = Date.now()
                                                                                        const cooling = k.cooledDownUntil && new Date(k.cooledDownUntil).getTime() > now
                                                                                        const recovering = !cooling && k.lastError
                                                                                        if (cooling) {
                                                                                            const secsLeft = Math.ceil((new Date(k.cooledDownUntil!).getTime() - now) / 1000)
                                                                                            return (
                                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '2px 7px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                                                                        🔴 Cooling down · {secsLeft}s left
                                                                                                    </span>
                                                                                                    <div style={{ color: '#ef4444', fontSize: '0.6rem', lineHeight: 1.4, opacity: 0.8 }}>
                                                                                                        {k.lastError?.slice(0, 60)}{(k.lastError?.length ?? 0) > 60 ? '…' : ''}
                                                                                                    </div>
                                                                                                    <button type="button" onClick={async () => {
                                                                                                        await fetch('/api/admin/api-keys', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id, clearError: true }) })
                                                                                                        setApiKeys(prev => prev.map(pk => pk.id === k.id ? { ...pk, lastError: null, cooledDownUntil: null } : pk))
                                                                                                    }} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.6rem', padding: 0, textDecoration: 'underline' }}>Force clear cooldown</button>
                                                                                                </div>
                                                                                            )
                                                                                        }
                                                                                        if (recovering) {
                                                                                            return (
                                                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', padding: '2px 7px', borderRadius: '10px', border: '1px solid rgba(245,158,11,0.2)' }}>
                                                                                                        🟡 Recovering — clears on next success
                                                                                                    </span>
                                                                                                    <div style={{ color: '#f59e0b', fontSize: '0.6rem', lineHeight: 1.4, opacity: 0.8 }}>
                                                                                                        Last error: {k.lastError?.slice(0, 60)}{(k.lastError?.length ?? 0) > 60 ? '…' : ''}
                                                                                                    </div>
                                                                                                    <button type="button" onClick={async () => {
                                                                                                        await fetch('/api/admin/api-keys', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id, clearError: true }) })
                                                                                                        setApiKeys(prev => prev.map(pk => pk.id === k.id ? { ...pk, lastError: null, cooledDownUntil: null } : pk))
                                                                                                    }} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.6rem', padding: 0, textDecoration: 'underline' }}>Mark resolved</button>
                                                                                                </div>
                                                                                            )
                                                                                        }
                                                                                        return (
                                                                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.6rem', fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.07)', padding: '2px 7px', borderRadius: '10px', border: '1px solid rgba(52,211,153,0.15)' }}>
                                                                                                🟢 Healthy
                                                                                            </span>
                                                                                        )
                                                                                    })()}
                                                                                </div>
                                                                            </td>
                                                                            <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                                                                <button type="button" title="Toggle Active" onClick={async () => {
                                                                                    await fetch('/api/admin/api-keys', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id, isActive: !k.isActive }) })
                                                                                    setApiKeys(prev => prev.map(pk => pk.id === k.id ? { ...pk, isActive: !pk.isActive } : pk))
                                                                                }} style={{ padding: '4px', fontSize: '0.8rem', background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.8 }}>
                                                                                    {k.isActive ? '⏸' : '▶'}
                                                                                </button>
                                                                                <button type="button" title="Delete Key" onClick={async () => {
                                                                                    if (!confirm(`Delete key "${k.label}"?`)) return
                                                                                    await fetch(`/api/admin/api-keys?id=${k.id}`, { method: 'DELETE' })
                                                                                    setApiKeys(prev => prev.filter(pk => pk.id !== k.id))
                                                                                }} style={{ padding: '4px', fontSize: '0.8rem', background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', opacity: 0.8 }}>
                                                                                    🗑
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                })
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </>
                                        )
                                    })()}

                                    <div style={{
                                        marginTop: 'var(--space-lg)', padding: 'var(--space-md)',
                                        background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
                                        fontSize: '0.68rem', color: 'var(--text-tertiary)', lineHeight: 1.6,
                                    }}>
                                        💡 <strong>Key Rotation:</strong> When an agent hits a rate limit on one key, it automatically tries the next active key in its pool.
                                        Keys assigned to <strong>All Agents</strong> are shared across every agent.
                                    </div>
                                </section>
                            )}

                            {/* ─── Casting ─── */}
                            {tab === 'casting' && (
                                <section className="admin-form-section">
                                    <h3 className="admin-form-section-title">🎬 Casting Pipeline</h3>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
                                        Configure defaults for casting calls and application workflows. Individual calls can override these.
                                    </p>

                                    {/* Visual Pipeline */}
                                    <div style={{
                                        padding: 'var(--space-lg)', marginBottom: 'var(--space-xl)',
                                        background: 'linear-gradient(135deg, rgba(59,130,246,0.04), rgba(52,211,153,0.03))',
                                        border: '1px solid rgba(59,130,246,0.1)', borderRadius: 'var(--radius-lg)',
                                    }}>
                                        <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3b82f6', marginBottom: 'var(--space-md)' }}>Application Journey</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap' }}>
                                            {[
                                                { s: 'Submitted', c: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
                                                { s: 'Under Review', c: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                                                { s: 'Shortlisted', c: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
                                                { s: 'Contacted', c: '#d4a853', bg: 'rgba(212,168,83,0.1)' },
                                                { s: 'Final Review', c: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                                                { s: 'Selected', c: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                                            ].map((item, i) => (
                                                <div key={item.s} style={{ display: 'flex', alignItems: 'center' }}>
                                                    <span style={{
                                                        fontSize: '0.62rem', padding: '3px 8px', borderRadius: '10px',
                                                        background: item.bg, color: item.c, fontWeight: 700,
                                                        border: `1px solid ${item.c}20`,
                                                    }}>{item.s}</span>
                                                    {i < 5 && <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', margin: '0 2px' }}>→</span>}
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                                            Applicants see their progress through these stages in real-time.
                                        </div>
                                    </div>

                                    <div className="admin-form-grid" style={{ marginBottom: 'var(--space-lg)' }}>
                                        <div style={{
                                            padding: 'var(--space-md)', borderRadius: 'var(--radius-md)',
                                            background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                        }}>
                                            <label className="admin-label">⏱️ Default Deadline (days)</label>
                                            <input className="admin-input" type="number" min={1} max={365} value={settings.defaultDeadlineDays}
                                                onChange={e => update('defaultDeadlineDays', parseInt(e.target.value) || 30)} />
                                            <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                                New calls expire ~{(() => { const d = new Date(); d.setDate(d.getDate() + settings.defaultDeadlineDays); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); })()}
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: 'var(--space-md)', borderRadius: 'var(--radius-md)',
                                            background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                        }}>
                                            <label className="admin-label">📸 Max Photo Uploads</label>
                                            <input className="admin-input" type="number" min={1} max={20} value={settings.maxPhotoUploads}
                                                onChange={e => update('maxPhotoUploads', parseInt(e.target.value) || 6)} />
                                            <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                                Applicants can upload up to {settings.maxPhotoUploads} headshots/photos
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{
                                        padding: 'var(--space-md)', borderRadius: 'var(--radius-md)',
                                        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                        marginBottom: 'var(--space-lg)',
                                    }}>
                                        <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '6px' }}>Application Requirements</div>
                                        <Toggle checked={settings.requireVoice} onChange={v => {
                                            if (v && !confirm('Enable voice hard-requirement?\n\nApplicants who do not submit a voice/self-tape recording will receive a −25 point penalty and be capped at WEAK_FIT recommendation.\n\nAre you sure?')) return
                                            if (!v && !confirm('Disable voice hard-requirement?\n\nThe penalty for missing voice recordings will revert to the default −5 points.\n\nProceed?')) return
                                            update('requireVoice', v)
                                        }} label="Require voice recording in applications" />
                                        <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '-4px', marginBottom: '8px', lineHeight: 1.5, paddingLeft: '2px' }}>
                                            When enabled, applicants without a voice/self-tape receive a <strong style={{ color: '#ef4444' }}>−25 pt</strong> penalty and are capped at <strong>WEAK_FIT</strong>. When disabled, the penalty is only −5 pts.
                                        </div>
                                        <Toggle checked={settings.castingAutoClose} onChange={v => update('castingAutoClose', v)} label="Auto-close casting when all roles are filled" />
                                    </div>

                                    {/* Pipeline Automation */}
                                    <div style={{
                                        padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)',
                                        background: 'linear-gradient(135deg, rgba(139,92,246,0.04), rgba(212,168,83,0.03))',
                                        border: '1px solid rgba(139,92,246,0.12)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                                            <div>
                                                <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#8b5cf6' }}>🤖 Pipeline Automation</div>
                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>AI-driven auto-advance and applicant notifications</div>
                                            </div>
                                            <span style={{
                                                fontSize: '0.5rem', padding: '2px 8px', borderRadius: '8px', fontWeight: 700,
                                                background: settings.pipelineAutoAdvance ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)',
                                                color: settings.pipelineAutoAdvance ? '#22c55e' : '#ef4444',
                                            }}>{settings.pipelineAutoAdvance ? 'ACTIVE' : 'OFF'}</span>
                                        </div>

                                        <Toggle checked={settings.pipelineAutoAdvance} onChange={v => update('pipelineAutoAdvance', v)} label="Enable AI-driven auto-advance" />
                                        <Toggle checked={settings.aiAutoAudit} onChange={v => update('aiAutoAudit', v)} label="Auto-run AI audit on new applications" />
                                        <Toggle checked={settings.notifyApplicantOnStatusChange} onChange={v => update('notifyApplicantOnStatusChange', v)} label="Email applicant when status changes" />

                                        {/* Broadcast Triggers */}
                                        <div style={{ marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-subtle)' }}>
                                            <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent-gold)', marginBottom: 'var(--space-sm)' }}>
                                                📣 Broadcast Notifications
                                            </div>
                                            <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }}>
                                                Notify all opted-in users when admin publishes content.
                                            </div>
                                            <Toggle checked={settings.notifyOnNewRole ?? true} onChange={v => update('notifyOnNewRole', v)} label="Notify users when a new casting role is published" />
                                            <Toggle checked={settings.notifyOnAnnouncement ?? true} onChange={v => update('notifyOnAnnouncement', v)} label="Notify users when an announcement is posted" />
                                            <Toggle checked={settings.notifyOnContentPublish ?? false} onChange={v => update('notifyOnContentPublish', v)} label="Notify users when new content goes live" />
                                        </div>

                                        {settings.pipelineAutoAdvance && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: 'var(--space-md)' }}>
                                                <div style={{ padding: '10px', background: 'rgba(34,197,94,0.04)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(34,197,94,0.1)' }}>
                                                    <label className="admin-label" style={{ color: '#22c55e', fontSize: '0.6rem' }}>⭐ Auto-Shortlist Threshold</label>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <input type="range" min={50} max={95} value={settings.autoShortlistThreshold}
                                                            onChange={e => update('autoShortlistThreshold', parseInt(e.target.value))}
                                                            style={{ flex: 1, accentColor: '#22c55e' }} />
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#22c55e', minWidth: '32px', textAlign: 'right' }}>{settings.autoShortlistThreshold}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>AI score ≥ {settings.autoShortlistThreshold} → auto-shortlisted</div>
                                                </div>
                                                <div style={{ padding: '10px', background: 'rgba(239,68,68,0.04)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.1)' }}>
                                                    <label className="admin-label" style={{ color: '#ef4444', fontSize: '0.6rem' }}>❌ Auto-Reject Threshold</label>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <input type="range" min={5} max={49} value={settings.autoRejectThreshold}
                                                            onChange={e => update('autoRejectThreshold', parseInt(e.target.value))}
                                                            style={{ flex: 1, accentColor: '#ef4444' }} />
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#ef4444', minWidth: '32px', textAlign: 'right' }}>{settings.autoRejectThreshold}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>AI score ≤ {settings.autoRejectThreshold} → auto-rejected</div>
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ marginTop: 'var(--space-md)', padding: '10px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', fontSize: '0.62rem', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                                            💡 <strong>How it works:</strong> After AI audit, applications are automatically advanced based on their score. Applicants between the two thresholds remain in &ldquo;Under Review&rdquo; for manual decision. Email notifications are logged and sent at each stage change.
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* ─── Content Access ─── */}
                            {tab === 'content' && (
                                <section className="admin-form-section">
                                    <h3 className="admin-form-section-title">🔒 Access Control</h3>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
                                        Control authentication gates for content across the platform.
                                    </p>

                                    {/* Access Control Toggles */}
                                    <div style={{
                                        padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)',
                                        background: 'linear-gradient(135deg, rgba(52,211,153,0.04), rgba(59,130,246,0.03))',
                                        border: '1px solid rgba(52,211,153,0.12)',
                                        marginBottom: 'var(--space-lg)',
                                    }}>
                                        <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#34d399', marginBottom: 'var(--space-md)' }}>🎬 Content Viewing</div>
                                        <Toggle checked={settings.requireLoginForFilms} onChange={v => update('requireLoginForFilms', v)} label="Require login to watch full films" />
                                        <Toggle checked={settings.allowPublicTrailers} onChange={v => update('allowPublicTrailers', v)} label="Allow trailers to be publicly viewable" />
                                        <Toggle checked={settings.allowPublicProjectPages} onChange={v => update('allowPublicProjectPages', v)} label="Allow project detail pages without login" />

                                        {/* Trailer Preview Gate — only relevant when trailers are public */}
                                        {settings.allowPublicTrailers && (
                                            <div style={{
                                                marginTop: 'var(--space-md)', padding: 'var(--space-md)',
                                                borderRadius: 'var(--radius-md)',
                                                background: 'rgba(212,168,83,0.04)',
                                                border: '1px solid rgba(212,168,83,0.12)',
                                            }}>
                                                <div style={{ fontSize: '0.55rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#d4a853', marginBottom: 'var(--space-sm)' }}>⏱ Trailer Preview Gate</div>
                                                <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)', lineHeight: 1.5 }}>
                                                    When enabled, logged-out viewers see a preview of the trailer before being prompted to sign in.
                                                </p>
                                                <Toggle checked={settings.trailerPreviewEnabled} onChange={v => update('trailerPreviewEnabled', v)} label="Enable trailer preview gate" />
                                                {settings.trailerPreviewEnabled && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                            Preview duration (seconds)
                                                            <input
                                                                type="number"
                                                                min={5}
                                                                max={120}
                                                                value={settings.trailerPreviewSeconds}
                                                                onChange={e => update('trailerPreviewSeconds', parseInt(e.target.value) || 15)}
                                                                className="admin-input"
                                                                style={{ marginTop: '4px', width: '100px' }}
                                                            />
                                                        </label>
                                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                                            Custom gate message (optional)
                                                            <input
                                                                type="text"
                                                                value={settings.trailerPreviewMessage}
                                                                onChange={e => update('trailerPreviewMessage', e.target.value)}
                                                                placeholder="Sign in to watch the full trailer"
                                                                className="admin-input"
                                                                style={{ marginTop: '4px' }}
                                                            />
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div style={{
                                        padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)',
                                        background: 'linear-gradient(135deg, rgba(245,158,11,0.04), rgba(212,168,83,0.03))',
                                        border: '1px solid rgba(245,158,11,0.12)',
                                        marginBottom: 'var(--space-lg)',
                                    }}>
                                        <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#f59e0b', marginBottom: 'var(--space-md)' }}>🔐 Page Access Gates</div>
                                        <Toggle checked={settings.requireLoginForCasting} onChange={v => update('requireLoginForCasting', v)} label="Require login to view casting listings" />
                                        <Toggle checked={settings.requireLoginForDonate} onChange={v => update('requireLoginForDonate', v)} label="Require login to access donate page" />
                                    </div>

                                    <div style={{
                                        padding: 'var(--space-md)', borderRadius: 'var(--radius-md)',
                                        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                        marginBottom: 'var(--space-md)',
                                        fontSize: '0.68rem', color: 'var(--text-tertiary)', lineHeight: 1.6,
                                    }}>
                                        💡 <strong>Always login-required:</strong> Dashboard, watchlist, casting applications, and member profiles always require authentication. These cannot be made public.
                                    </div>

                                    {/* Section Visibility Toggles */}
                                    <div style={{
                                        padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)',
                                        background: 'linear-gradient(135deg, rgba(168,85,247,0.04), rgba(212,168,83,0.03))',
                                        border: '1px solid rgba(168,85,247,0.12)',
                                        marginBottom: 'var(--space-lg)',
                                    }}>
                                        <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#a855f7', marginBottom: 'var(--space-md)' }}>📡 Section Visibility</div>
                                        <p style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)', lineHeight: 1.5 }}>
                                            Control which sections appear in the site navigation. Hidden sections return a &quot;Coming Soon&quot; page.
                                        </p>
                                        {[
                                            { key: 'castingCallsEnabled' as const, icon: '🎭', label: 'Casting Calls', desc: 'Show casting section and allow applications' },
                                            { key: 'scriptCallsEnabled' as const, icon: '✍️', label: 'Script Calls', desc: 'Show script submissions page' },
                                            { key: 'trainingEnabled' as const, icon: '🎓', label: 'Training Hub', desc: 'Show training courses and workshops' },
                                            { key: 'sponsorsPageEnabled' as const, icon: '🤝', label: 'Sponsors Page', desc: 'Publish the public sponsors page — homepage sponsor widgets are unaffected' },
                                        ].map(section => (
                                            <div key={section.key} style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '10px 12px', borderRadius: 'var(--radius-md)',
                                                background: (settings as Record<string, unknown>)[section.key] ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.02)',
                                                border: `1px solid ${(settings as Record<string, unknown>)[section.key] ? 'rgba(52,211,153,0.12)' : 'var(--border-subtle)'}`,
                                                marginBottom: '6px', transition: 'all 0.2s',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ fontSize: '1.1rem' }}>{section.icon}</span>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{section.label}</span>
                                                            <span style={{
                                                                fontSize: '0.48rem', padding: '1px 6px', borderRadius: '8px',
                                                                background: (settings as Record<string, unknown>)[section.key] ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.08)',
                                                                color: (settings as Record<string, unknown>)[section.key] ? '#34d399' : '#ef4444',
                                                                fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                                                            }}>{(settings as Record<string, unknown>)[section.key] ? 'LIVE' : 'HIDDEN'}</span>
                                                        </div>
                                                        <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '1px' }}>{section.desc}</div>
                                                    </div>
                                                </div>
                                                <Toggle checked={!!(settings as Record<string, unknown>)[section.key]} onChange={v => update(section.key, v)} label="" />
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* ─── Authentication / OAuth ─── */}
                            {tab === 'auth' && (
                                <section className="admin-form-section">
                                    <h3 className="admin-form-section-title">🔐 Sign-In Providers</h3>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
                                        Social sign-in buttons appear on the login page only when credentials are configured.
                                    </p>

                                    {/* Google OAuth */}
                                    <div style={{
                                        padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-md)',
                                        background: settings.googleClientId ? 'rgba(66,133,244,0.03)' : 'var(--bg-primary)',
                                        border: `1px solid ${settings.googleClientId ? 'rgba(66,133,244,0.15)' : 'var(--border-subtle)'}`,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '1.1rem' }}>🔵</span>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Google OAuth</span>
                                            </div>
                                            <span style={{
                                                fontSize: '0.55rem', padding: '2px 8px', borderRadius: '8px', fontWeight: 700,
                                                background: settings.googleClientId && settings.googleClientSecret ? 'rgba(52,211,153,0.1)' : 'rgba(107,114,128,0.1)',
                                                color: settings.googleClientId && settings.googleClientSecret ? '#34d399' : 'var(--text-tertiary)',
                                            }}>{settings.googleClientId && settings.googleClientSecret ? '✓ CONFIGURED' : '○ NOT SET'}</span>
                                        </div>
                                        <div className="admin-form-grid" style={{ marginBottom: 'var(--space-sm)' }}>
                                            <div><label className="admin-label">Client ID</label>
                                                <input className="admin-input" value={settings.googleClientId} onChange={e => update('googleClientId', e.target.value)} placeholder="xxxxx.apps.googleusercontent.com" /></div>
                                            <div><label className="admin-label">Client Secret</label>
                                                <input className="admin-input" type="password" value={settings.googleClientSecret} onChange={e => update('googleClientSecret', e.target.value)} placeholder="GOCSPX-..." /></div>
                                        </div>
                                        <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>
                                            Setup at <a href="https://console.cloud.google.com" target="_blank" rel="noopener" style={{ color: 'var(--accent-gold)' }}>console.cloud.google.com</a> → APIs → Credentials.
                                            Redirect URI: <code style={{ fontSize: '0.6rem', background: 'rgba(255,255,255,0.05)', padding: '1px 4px', borderRadius: '3px' }}>{'<your-domain>/api/auth/google/callback'}</code>
                                        </div>
                                    </div>

                                    {/* Apple Sign-In */}
                                    <div style={{
                                        padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)',
                                        background: settings.appleClientId ? 'rgba(255,255,255,0.02)' : 'var(--bg-primary)',
                                        border: `1px solid ${settings.appleClientId ? 'rgba(255,255,255,0.1)' : 'var(--border-subtle)'}`,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '1.1rem' }}>🍎</span>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Apple Sign-In</span>
                                            </div>
                                            <span style={{
                                                fontSize: '0.55rem', padding: '2px 8px', borderRadius: '8px', fontWeight: 700,
                                                background: settings.appleClientId ? 'rgba(52,211,153,0.1)' : 'rgba(107,114,128,0.1)',
                                                color: settings.appleClientId ? '#34d399' : 'var(--text-tertiary)',
                                            }}>{settings.appleClientId ? '✓ CONFIGURED' : '○ NOT SET'}</span>
                                        </div>
                                        <div className="admin-form-grid" style={{ marginBottom: 'var(--space-sm)' }}>
                                            <div><label className="admin-label">Service ID</label>
                                                <input className="admin-input" value={settings.appleClientId} onChange={e => update('appleClientId', e.target.value)} placeholder="com.example.myapp" /></div>
                                            <div><label className="admin-label">Team ID</label>
                                                <input className="admin-input" value={settings.appleTeamId} onChange={e => update('appleTeamId', e.target.value)} placeholder="ABC123DEF4" /></div>
                                        </div>
                                        <div className="admin-form-grid" style={{ marginBottom: 'var(--space-sm)' }}>
                                            <div><label className="admin-label">Key ID</label>
                                                <input className="admin-input" value={settings.appleKeyId} onChange={e => update('appleKeyId', e.target.value)} placeholder="XYZ789" /></div>
                                            <div><label className="admin-label">Private Key (PEM)</label>
                                                <textarea value={settings.applePrivateKey} onChange={e => update('applePrivateKey', e.target.value)}
                                                    placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"} rows={3}
                                                    className="admin-input" style={{ fontFamily: 'monospace', fontSize: '0.68rem' }} /></div>
                                        </div>
                                        <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>
                                            Configure at <a href="https://developer.apple.com" target="_blank" rel="noopener" style={{ color: 'var(--accent-gold)' }}>developer.apple.com</a> → Certificates, IDs & Profiles.
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* ─── Donations ─── */}
                            {tab === 'donations' && (
                                <section className="admin-form-section">
                                    <h3 className="admin-form-section-title">💰 Funding & Notifications</h3>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
                                        Control financial contribution features and notification routing.
                                    </p>

                                    {/* Donations control */}
                                    <div style={{
                                        padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-lg)',
                                        background: settings.donationsEnabled ? 'rgba(52,211,153,0.03)' : 'rgba(239,68,68,0.02)',
                                        border: `1px solid ${settings.donationsEnabled ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.1)'}`,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '1.2rem' }}>💳</span>
                                                <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Donation System</span>
                                            </div>
                                            <span style={{
                                                fontSize: '0.55rem', padding: '2px 10px', borderRadius: '8px', fontWeight: 700,
                                                background: settings.donationsEnabled ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.08)',
                                                color: settings.donationsEnabled ? '#34d399' : '#ef4444',
                                            }}>{settings.donationsEnabled ? '● ENABLED' : '● DISABLED'}</span>
                                        </div>
                                        <Toggle checked={settings.donationsEnabled} onChange={v => update('donationsEnabled', v)} label="Accept donations through the platform" />
                                    </div>

                                    <div style={{
                                        padding: 'var(--space-md)', borderRadius: 'var(--radius-md)',
                                        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                        marginBottom: 'var(--space-lg)',
                                    }}>
                                        <label className="admin-label">💵 Minimum Donation Amount ($)</label>
                                        <input className="admin-input" type="number" min={1} step={1} value={settings.donationMinAmount}
                                            onChange={e => update('donationMinAmount', parseFloat(e.target.value) || 5)} />
                                        <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                            Supporters will see "${settings.donationMinAmount}" as the minimum contribution
                                        </div>
                                    </div>

                                    <div style={{
                                        padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)',
                                        background: 'linear-gradient(135deg, rgba(245,158,11,0.04), rgba(239,68,68,0.02))',
                                        border: '1px solid rgba(245,158,11,0.1)',
                                    }}>
                                        <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f59e0b', marginBottom: 'var(--space-md)' }}>🔔 Notification Routing</div>
                                        <Toggle checked={settings.notifyOnApplication} onChange={v => update('notifyOnApplication', v)} label="Notify on new casting applications" />
                                        <Toggle checked={settings.notifyOnDonation} onChange={v => update('notifyOnDonation', v)} label="Notify on new donations" />
                                        <div style={{ marginTop: 'var(--space-md)' }}>
                                            <label className="admin-label">📧 Notification Email <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(overrides contact email)</span></label>
                                            <input className="admin-input" type="email" value={settings.notifyEmail} onChange={e => update('notifyEmail', e.target.value)} placeholder="notifications@aim.com" />
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* ─── Email / SMTP ─── */}
                            {tab === 'email' && (
                                <EmailSmtpTab settings={settings} update={update} Toggle={Toggle} />
                            )}

                            {/* ─── Security ─── */}
                            {tab === 'security' && (
                                <section className="admin-form-section">
                                    <h3 className="admin-form-section-title">🛡️ Admin Security</h3>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
                                        Manage your credentials, create power admins, and review session parameters.
                                    </p>

                                    {/* ── Change Display Name ── */}
                                    <div style={{
                                        padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-lg)',
                                        background: 'linear-gradient(135deg, rgba(59,130,246,0.03), rgba(168,85,247,0.02))',
                                        border: '1px solid rgba(59,130,246,0.1)',
                                    }}>
                                        <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#3b82f6', marginBottom: 'var(--space-md)' }}>👤 Change Display Name</div>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                                            <div style={{ flex: 1 }}>
                                                <label className="admin-label">New Display Name</label>
                                                <input className="admin-input" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder="Enter new display name" />
                                            </div>
                                            <button type="button" onClick={handleNameChange} disabled={nameSaving || !newDisplayName.trim()}
                                                className="btn btn-secondary" style={{ opacity: newDisplayName.trim() ? 1 : 0.4, whiteSpace: 'nowrap' }}>
                                                {nameSaving ? 'Saving…' : '✏️ Update Name'}
                                            </button>
                                        </div>
                                        {nameMsg && (
                                            <div style={{
                                                fontSize: '0.75rem', fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--radius-md)', marginTop: '8px',
                                                color: nameMsg.startsWith('✓') ? 'var(--success)' : 'var(--error)',
                                                background: nameMsg.startsWith('✓') ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                                            }}>{nameMsg}</div>
                                        )}
                                    </div>

                                    {/* ── Change Password ── */}
                                    <div style={{
                                        padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-lg)',
                                        background: 'linear-gradient(135deg, rgba(239,68,68,0.03), rgba(168,85,247,0.02))',
                                        border: '1px solid rgba(239,68,68,0.1)',
                                    }}>
                                        <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#ef4444', marginBottom: 'var(--space-md)' }}>🔑 Change Password</div>
                                        <div style={{ marginBottom: 'var(--space-md)' }}>
                                            <label className="admin-label">Current Password *</label>
                                            <input className="admin-input" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
                                        </div>
                                        <div className="admin-form-grid" style={{ marginBottom: 'var(--space-md)' }}>
                                            <div>
                                                <label className="admin-label">New Password</label>
                                                <input className="admin-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters" />
                                                {newPassword && (
                                                    <div style={{ fontSize: '0.6rem', marginTop: '3px', color: newPassword.length >= 6 ? '#34d399' : '#ef4444' }}>
                                                        {newPassword.length >= 12 ? '🟢 Strong' : newPassword.length >= 8 ? '🟡 Good' : newPassword.length >= 6 ? '🟠 Acceptable' : '🔴 Too short'}
                                                        {' · '}{newPassword.length} chars
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="admin-label">Confirm Password</label>
                                                <input className="admin-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" />
                                                {confirmPassword && (
                                                    <div style={{ fontSize: '0.6rem', marginTop: '3px', color: confirmPassword === newPassword ? '#34d399' : '#ef4444' }}>
                                                        {confirmPassword === newPassword ? '✓ Matches' : '✗ Does not match'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {pwMsg && (
                                            <div style={{
                                                fontSize: '0.75rem', fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)',
                                                color: pwMsg.startsWith('✓') ? 'var(--success)' : 'var(--error)',
                                                background: pwMsg.startsWith('✓') ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.1)',
                                            }}>{pwMsg}</div>
                                        )}
                                        <button type="button" onClick={handlePasswordChange} disabled={pwSaving || !currentPassword || !newPassword || newPassword !== confirmPassword}
                                            className="btn btn-secondary" style={{
                                                alignSelf: 'flex-start',
                                                opacity: currentPassword && newPassword && newPassword === confirmPassword ? 1 : 0.4,
                                            }}>
                                            {pwSaving ? 'Updating…' : '🔑 Update Password'}
                                        </button>
                                    </div>

                                    {/* ── Create Power Admin ── */}
                                    <div style={{
                                        padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-lg)',
                                        background: 'linear-gradient(135deg, rgba(34,197,94,0.03), rgba(59,130,246,0.02))',
                                        border: '1px solid rgba(34,197,94,0.1)',
                                    }}>
                                        <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#22c55e', marginBottom: 'var(--space-md)' }}>🛡️ Create Power Admin</div>
                                        <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)', lineHeight: 1.5 }}>
                                            Power admins can access all admin panels. Only superadmins can create them.
                                        </p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                                            <div>
                                                <label className="admin-label">Full Name *</label>
                                                <input className="admin-input" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} placeholder="e.g. John Smith" />
                                            </div>
                                            <div>
                                                <label className="admin-label">Email *</label>
                                                <input className="admin-input" type="email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} placeholder="admin@aim.com" />
                                            </div>
                                        </div>
                                        <div style={{ marginBottom: 'var(--space-md)' }}>
                                            <label className="admin-label">Password * <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(min 6 chars)</span></label>
                                            <input className="admin-input" type="password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} placeholder="Secure password" />
                                        </div>
                                        {createAdminMsg && (
                                            <div style={{
                                                fontSize: '0.75rem', fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)',
                                                color: createAdminMsg.startsWith('✓') ? '#22c55e' : '#ef4444',
                                                background: createAdminMsg.startsWith('✓') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                                            }}>{createAdminMsg}</div>
                                        )}
                                        <button type="button" onClick={handleCreateAdmin}
                                            disabled={createAdminSaving || !newAdminName.trim() || !newAdminEmail.trim() || !newAdminPassword}
                                            className="btn btn-secondary" style={{
                                                background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)',
                                                opacity: newAdminName.trim() && newAdminEmail.trim() && newAdminPassword ? 1 : 0.4,
                                            }}>
                                            {createAdminSaving ? 'Creating…' : '➕ Create Power Admin'}
                                        </button>
                                    </div>

                                    {/* ── Admin Roster ── */}
                                    <div style={{
                                        padding: 'var(--space-lg)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-lg)',
                                        background: 'linear-gradient(135deg, rgba(168,85,247,0.03), rgba(245,158,11,0.02))',
                                        border: '1px solid rgba(168,85,247,0.1)',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                                            <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#a855f7' }}>👥 Admin Roster</div>
                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                                                {adminsLoading ? 'Loading...' : `${adminList.length} admin${adminList.length !== 1 ? 's' : ''}`}
                                            </span>
                                        </div>
                                        <div style={{ display: 'grid', gap: '8px' }}>
                                            {adminList.map(admin => (
                                                <div key={admin.id} style={{
                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                    padding: '10px 14px', borderRadius: 'var(--radius-md)',
                                                    background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <div style={{
                                                            width: '32px', height: '32px', borderRadius: '50%',
                                                            background: admin.role === 'superadmin'
                                                                ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                                                                : 'linear-gradient(135deg, #3b82f6, #a855f7)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: '0.75rem', fontWeight: 800, color: '#fff',
                                                        }}>
                                                            {admin.name?.[0]?.toUpperCase() || '?'}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>{admin.name}</div>
                                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{admin.email}</div>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{
                                                            fontSize: '0.6rem', fontWeight: 700, padding: '3px 10px', borderRadius: '20px',
                                                            textTransform: 'uppercase', letterSpacing: '0.05em',
                                                            background: admin.role === 'superadmin' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.1)',
                                                            color: admin.role === 'superadmin' ? '#f59e0b' : '#3b82f6',
                                                        }}>
                                                            {admin.role === 'superadmin' ? '👑 Super Admin' : '🛡️ Power Admin'}
                                                        </span>
                                                        {admin.role === 'admin' && (
                                                            <button
                                                                onClick={() => handleDemoteAdmin(admin.id, admin.name)}
                                                                style={{
                                                                    padding: '4px 10px', fontSize: '0.62rem', fontWeight: 600,
                                                                    background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                                                                    border: '1px solid rgba(239,68,68,0.15)', borderRadius: '6px',
                                                                    cursor: 'pointer',
                                                                }}
                                                            >Demote</button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ── Session Config ── */}
                                    <div style={{
                                        padding: 'var(--space-md)', borderRadius: 'var(--radius-md)',
                                        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                                    }}>
                                        <div style={{ fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '8px' }}>🔒 Session Config</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                            {[
                                                { label: 'Expiration', value: '7 days', icon: '⏱️' },
                                                { label: 'Algorithm', value: 'HS256', icon: '🔐' },
                                                { label: 'Type', value: 'JWT', icon: '📋' },
                                            ].map(s => (
                                                <div key={s.label} style={{
                                                    textAlign: 'center', padding: '8px',
                                                    background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)',
                                                    border: '1px solid var(--border-subtle)',
                                                }}>
                                                    <div style={{ fontSize: '0.9rem', marginBottom: '2px' }}>{s.icon}</div>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>{s.value}</div>
                                                    <div style={{ fontSize: '0.58rem', color: 'var(--text-tertiary)' }}>{s.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            )}



                            {/* Save button — not shown on Security tab */}
                            {tab !== 'security' && tab !== 'apikeys' && tab !== 'email' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', paddingBottom: 'var(--space-xl)' }}>
                                    <button type="submit" className="btn btn-primary" disabled={saving} style={{
                                        minWidth: '200px',
                                        background: dirty ? 'linear-gradient(135deg, #d4a853, #b8942e)' : 'linear-gradient(135deg, rgba(52,211,153,0.2), rgba(52,211,153,0.1))',
                                        border: dirty ? 'none' : '1px solid rgba(52,211,153,0.3)',
                                        color: dirty ? 'var(--bg-primary)' : 'var(--success)',
                                    }}>
                                        {saving ? 'Saving…' : dirty ? '● Unsaved Changes: Save Now' : '✓ All Changes Saved'}
                                    </button>
                                    {!dirty && !saving && (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Settings are up to date</span>
                                    )}
                                </div>
                            )}
                        </form>
                    </div>
                )}
            </main>
        </div>
    )
}
