'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

export default function ScriptSubmissionForm({ callId }: { callId: string }) {
    const t = useTranslations('scripts')

    const [form, setForm] = useState({
        authorName: '', authorEmail: '', authorBio: '',
        title: '', logline: '', synopsis: '',
        scriptText: '', genre: '', estimatedDuration: '',
    })
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')
    const [focusedField, setFocusedField] = useState<string | null>(null)
    const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle')
    const [uploadedPath, setUploadedPath] = useState<string | null>(null)
    const [uploadFileName, setUploadFileName] = useState<string | null>(null)

    const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

    // Map API error strings to translation keys
    const localizeError = (raw: string): string => {
        if (raw.includes('no longer accepting')) return t('formErrorClosed')
        if (raw.includes('Maximum submissions')) return t('formErrorMax')
        if (raw.includes('required')) return t('formErrorRequired')
        return t('formErrorGeneric')
    }

    const handleFileUpload = async (file: File) => {
        setUploadState('uploading')
        setUploadFileName(file.name)
        try {
            // 1. Get presigned URL
            const presignRes = await fetch('/api/upload/presign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: file.type || 'application/octet-stream',
                    kind: 'document',
                    name: form.authorName || 'author',
                    scriptCallId: callId,
                }),
            })
            const { presignedUrl, finalUrl } = await presignRes.json()
            if (!presignRes.ok || !presignedUrl) throw new Error('Presign failed')
            // 2. PUT directly to R2
            const putRes = await fetch(presignedUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type || 'application/octet-stream' },
                body: file,
            })
            if (!putRes.ok) throw new Error('Upload failed')
            setUploadedPath(finalUrl)
            setUploadState('done')
        } catch {
            setUploadState('error')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        setError('')
        try {
            const res = await fetch(`/api/script-calls/${callId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, scriptFilePath: uploadedPath }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Submission failed')
            setSuccess(true)
        } catch (err: unknown) {
            setError(localizeError(err instanceof Error ? err.message : ''))
        } finally {
            setSubmitting(false)
        }
    }

    const inputBase: React.CSSProperties = {
        width: '100%',
        padding: '11px 14px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '10px',
        color: 'var(--text-primary)',
        fontSize: '0.875rem',
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s, background 0.2s',
        boxSizing: 'border-box',
    }

    const inputFocused: React.CSSProperties = {
        ...inputBase,
        borderColor: 'rgba(212,168,83,0.5)',
        boxShadow: '0 0 0 3px rgba(212,168,83,0.08)',
        background: 'rgba(212,168,83,0.03)',
    }

    const getInputStyle = (field: string) => focusedField === field ? inputFocused : inputBase

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '0.62rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--text-tertiary)',
        marginBottom: '5px',
    }

    const sectionHeaderStyle: React.CSSProperties = {
        fontSize: '0.6rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.14em',
        color: 'var(--accent-gold)',
        marginBottom: '14px',
        paddingBottom: '10px',
        borderBottom: '1px solid rgba(212,168,83,0.1)',
    }

    if (success) {
        return (
            <div style={{
                textAlign: 'center',
                padding: '48px 24px',
                background: 'radial-gradient(circle at 50% 0%, rgba(16,185,129,0.06), transparent 60%)',
            }}>
                <div style={{
                    width: '64px', height: '64px', borderRadius: '50%',
                    background: 'rgba(16,185,129,0.1)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.8rem', margin: '0 auto 20px',
                }}>✅</div>
                <h3 style={{
                    fontSize: '1.2rem', fontWeight: 800, marginBottom: '10px',
                    color: '#10b981',
                }}>
                    {t('formSuccessTitle')}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: '320px', margin: '0 auto' }}>
                    {t('formSuccessDesc')}
                </p>
            </div>
        )
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

            {/* ── Author section ── */}
            <div style={{ marginBottom: '24px' }}>
                <div style={sectionHeaderStyle}>👤 {t('authorSectionLabel')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={labelStyle}>{t('formNameLabel')} *</label>
                        <input
                            style={getInputStyle('authorName')}
                            value={form.authorName}
                            onChange={e => update('authorName', e.target.value)}
                            onFocus={() => setFocusedField('authorName')}
                            onBlur={() => setFocusedField(null)}
                            required
                            placeholder={t('formNamePlaceholder')}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>{t('formEmailLabel')} *</label>
                        <input
                            style={getInputStyle('authorEmail')}
                            type="email"
                            value={form.authorEmail}
                            onChange={e => update('authorEmail', e.target.value)}
                            onFocus={() => setFocusedField('authorEmail')}
                            onBlur={() => setFocusedField(null)}
                            required
                            placeholder={t('formEmailPlaceholder')}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>{t('formBioLabel')}</label>
                        <textarea
                            style={{ ...getInputStyle('authorBio'), minHeight: '68px', resize: 'vertical' }}
                            value={form.authorBio}
                            onChange={e => update('authorBio', e.target.value)}
                            onFocus={() => setFocusedField('authorBio')}
                            onBlur={() => setFocusedField(null)}
                            placeholder={t('formBioPlaceholder')}
                        />
                    </div>
                </div>
            </div>

            {/* ── Script section ── */}
            <div style={{ marginBottom: '24px' }}>
                <div style={sectionHeaderStyle}>📝 {t('scriptSectionLabel')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                        <label style={labelStyle}>{t('formScriptTitleLabel')} *</label>
                        <input
                            style={getInputStyle('title')}
                            value={form.title}
                            onChange={e => update('title', e.target.value)}
                            onFocus={() => setFocusedField('title')}
                            onBlur={() => setFocusedField(null)}
                            required
                            placeholder={t('formScriptTitlePlaceholder')}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>{t('formLoglineLabel')} *</label>
                        <input
                            style={getInputStyle('logline')}
                            value={form.logline}
                            onChange={e => update('logline', e.target.value)}
                            onFocus={() => setFocusedField('logline')}
                            onBlur={() => setFocusedField(null)}
                            required
                            placeholder={t('formLoglinePlaceholder')}
                        />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={labelStyle}>{t('formGenreLabel')}</label>
                            <input
                                style={getInputStyle('genre')}
                                value={form.genre}
                                onChange={e => update('genre', e.target.value)}
                                onFocus={() => setFocusedField('genre')}
                                onBlur={() => setFocusedField(null)}
                                placeholder={t('formGenrePlaceholder')}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>{t('formDurationLabel')}</label>
                            <input
                                style={getInputStyle('estimatedDuration')}
                                value={form.estimatedDuration}
                                onChange={e => update('estimatedDuration', e.target.value)}
                                onFocus={() => setFocusedField('estimatedDuration')}
                                onBlur={() => setFocusedField(null)}
                                placeholder={t('formDurationPlaceholder')}
                            />
                        </div>
                    </div>
                    <div>
                        <label style={labelStyle}>{t('formSynopsisLabel')} *</label>
                        <textarea
                            style={{ ...getInputStyle('synopsis'), minHeight: '100px', resize: 'vertical' }}
                            value={form.synopsis}
                            onChange={e => update('synopsis', e.target.value)}
                            onFocus={() => setFocusedField('synopsis')}
                            onBlur={() => setFocusedField(null)}
                            required
                            placeholder={t('formSynopsisPlaceholder')}
                        />
                    </div>
                    <div>
                        <label style={labelStyle}>{t('formScriptTextLabel')}</label>
                        <textarea
                            style={{ ...getInputStyle('scriptText'), minHeight: '160px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.78rem' }}
                            value={form.scriptText}
                            onChange={e => update('scriptText', e.target.value)}
                            onFocus={() => setFocusedField('scriptText')}
                            onBlur={() => setFocusedField(null)}
                            placeholder={t('formScriptTextPlaceholder')}
                        />
                    </div>

                    {/* ── File Upload ── */}
                    <div>
                        <label style={labelStyle}>{t('formUploadLabel')}</label>
                        <label
                            htmlFor="script-file-upload"
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'center',
                                justifyContent: 'center', gap: '8px',
                                padding: '22px 16px',
                                border: `1px dashed ${uploadState === 'done' ? 'rgba(16,185,129,0.5)' : uploadState === 'error' ? 'rgba(244,63,94,0.4)' : 'rgba(212,168,83,0.25)'}`,
                                borderRadius: '10px',
                                background: uploadState === 'done' ? 'rgba(16,185,129,0.04)' : uploadState === 'error' ? 'rgba(244,63,94,0.04)' : 'rgba(212,168,83,0.03)',
                                cursor: uploadState === 'uploading' ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <span style={{ fontSize: '1.4rem' }}>
                                {uploadState === 'done' ? '✅' : uploadState === 'error' ? '❌' : uploadState === 'uploading' ? '⏳' : '📄'}
                            </span>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: uploadState === 'done' ? '#10b981' : uploadState === 'error' ? '#f43f5e' : 'var(--text-secondary)' }}>
                                {uploadState === 'uploading' ? t('formUploading')
                                    : uploadState === 'done' ? `${t('formUploadDone')}: ${uploadFileName}`
                                    : uploadState === 'error' ? t('formUploadError')
                                    : t('formUploadBtn')}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                                {t('formUploadHint')}
                            </span>
                            <input
                                id="script-file-upload"
                                type="file"
                                accept=".pdf,.fdx,.txt,.fountain"
                                style={{ display: 'none' }}
                                disabled={uploadState === 'uploading'}
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
                            />
                        </label>
                        {uploadState === 'done' && (
                            <button
                                type="button"
                                onClick={() => { setUploadState('idle'); setUploadedPath(null); setUploadFileName(null) }}
                                style={{ marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                                ✕ Remove
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Disclaimer ── */}
            <div style={{
                marginBottom: '20px',
                padding: '16px 18px',
                background: 'rgba(212,168,83,0.04)',
                border: '1px solid rgba(212,168,83,0.14)',
                borderRadius: '12px',
            }}>
                <div style={{
                    fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
                    textTransform: 'uppercase', color: 'var(--accent-gold)',
                    marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                    📋 {t('disclaimerTitle')}
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {(['disclaimerItem1','disclaimerItem2','disclaimerItem3','disclaimerItem4','disclaimerItem5'] as const).map(key => (
                        <li key={key} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            {t(key)}
                        </li>
                    ))}
                </ul>
            </div>

            {/* ── Required note ── */}
            <p style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginBottom: '16px', margin: '0 0 16px' }}>
                {t('formRequired')}
            </p>

            {/* ── Error ── */}
            {error && (
                <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '10px',
                    padding: '12px 14px',
                    background: 'rgba(244,63,94,0.07)',
                    border: '1px solid rgba(244,63,94,0.2)',
                    borderRadius: '10px',
                    color: '#f43f5e',
                    fontSize: '0.82rem',
                    lineHeight: 1.5,
                    marginBottom: '16px',
                }}>
                    <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
                    {error}
                </div>
            )}

            {/* ── Submit ── */}
            <button
                type="submit"
                disabled={submitting}
                style={{
                    width: '100%',
                    padding: '13px',
                    background: submitting
                        ? 'rgba(212,168,83,0.4)'
                        : 'linear-gradient(135deg, #d4a853, #f0c96e)',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#0f1115',
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    letterSpacing: '0.04em',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    transition: 'all 0.25s ease',
                    boxShadow: submitting ? 'none' : '0 4px 20px rgba(212,168,83,0.25)',
                    fontFamily: 'inherit',
                }}
            >
                {submitting ? `⏳ ${t('formSubmitting')}` : `✍️ ${t('formSubmitBtn')}`}
            </button>

        </form>
    )
}
