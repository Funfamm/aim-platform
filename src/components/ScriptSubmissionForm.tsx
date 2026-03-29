'use client'

import { useState } from 'react'

export default function ScriptSubmissionForm({ callId }: { callId: string }) {
    const [form, setForm] = useState({
        authorName: '', authorEmail: '', authorBio: '',
        title: '', logline: '', synopsis: '',
        scriptText: '', genre: '', estimatedDuration: '',
    })
    const [submitting, setSubmitting] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState('')

    const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }))

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        setError('')

        try {
            const res = await fetch(`/api/script-calls/${callId}/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Submission failed')
            setSuccess(true)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Submission failed')
        } finally {
            setSubmitting(false)
        }
    }

    if (success) {
        return (
            <div style={{ textAlign: 'center', padding: 'var(--space-xl) 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 'var(--space-md)' }}>✅</div>
                <h3 style={{ marginBottom: 'var(--space-sm)', color: 'var(--color-success)' }}>Script Submitted!</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Your screenplay has been received. Our AI will analyze it and our team will review the top submissions.
                </p>
            </div>
        )
    }

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        color: 'var(--text-primary)',
        fontSize: '0.85rem',
        fontFamily: 'inherit',
        outline: 'none',
        transition: 'border-color 0.2s',
    }

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '0.65rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--text-tertiary)',
        marginBottom: '4px',
    }

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {/* Author Info */}
            <div>
                <label style={labelStyle}>Your Name *</label>
                <input style={inputStyle} value={form.authorName} onChange={e => update('authorName', e.target.value)} required placeholder="Full name" />
            </div>
            <div>
                <label style={labelStyle}>Email *</label>
                <input style={inputStyle} type="email" value={form.authorEmail} onChange={e => update('authorEmail', e.target.value)} required placeholder="your@email.com" />
            </div>
            <div>
                <label style={labelStyle}>Bio (optional)</label>
                <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={form.authorBio} onChange={e => update('authorBio', e.target.value)} placeholder="Brief writing background..." />
            </div>

            <div className="divider" />

            {/* Script Details */}
            <div>
                <label style={labelStyle}>Script Title *</label>
                <input style={inputStyle} value={form.title} onChange={e => update('title', e.target.value)} required placeholder="Your screenplay title" />
            </div>
            <div>
                <label style={labelStyle}>Logline (one-line pitch) *</label>
                <input style={inputStyle} value={form.logline} onChange={e => update('logline', e.target.value)} required placeholder="A one-sentence summary of your story" />
            </div>
            <div className="form-grid-2col">
                <div>
                    <label style={labelStyle}>Genre</label>
                    <input style={inputStyle} value={form.genre} onChange={e => update('genre', e.target.value)} placeholder="e.g. Sci-Fi, Drama" />
                </div>
                <div>
                    <label style={labelStyle}>Est. Duration</label>
                    <input style={inputStyle} value={form.estimatedDuration} onChange={e => update('estimatedDuration', e.target.value)} placeholder="e.g. 12 min" />
                </div>
            </div>
            <div>
                <label style={labelStyle}>Synopsis *</label>
                <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} value={form.synopsis} onChange={e => update('synopsis', e.target.value)} required placeholder="Full synopsis of your story (beginning, middle, end)..." />
            </div>
            <div>
                <label style={labelStyle}>Full Script (optional)</label>
                <textarea style={{ ...inputStyle, minHeight: '200px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.8rem' }} value={form.scriptText} onChange={e => update('scriptText', e.target.value)} placeholder="Paste your full screenplay here for AI analysis..." />
            </div>

            {error && (
                <div style={{ padding: '8px 12px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 'var(--radius-md)', color: 'var(--color-error)', fontSize: '0.8rem' }}>
                    {error}
                </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', cursor: 'pointer' }} disabled={submitting}>
                {submitting ? 'Submitting...' : '✍️ Submit Script'}
            </button>
        </form>
    )
}
