'use client'

import { useState, useRef } from 'react'

/**
 * ImportTab — Bulk suppression import UI for the admin email analytics dashboard.
 *
 * Supports:
 *   - File upload (.csv, .txt — one email per line)
 *   - Manual text area input
 *   - Reason selection (hard_bounce, complaint, unsubscribe, manual)
 *   - Result display with imported/skipped/invalid counts
 */
export default function ImportTab() {
    const [mode, setMode] = useState<'file' | 'paste'>('paste')
    const [pasteText, setPasteText] = useState('')
    const [reason, setReason] = useState('manual')
    const [importing, setImporting] = useState(false)
    const [result, setResult] = useState<{
        ok: boolean
        imported?: number
        skipped?: number
        invalid?: number
        invalidEmails?: string[]
        error?: string
    } | null>(null)
    const fileRef = useRef<HTMLInputElement>(null)

    const parseEmails = (text: string): string[] => {
        return text
            .split(/[\n,;]+/)
            .map(e => e.trim().toLowerCase())
            .filter(e => e.length > 0 && e.includes('@'))
    }

    const handleImport = async () => {
        let emails: string[] = []

        if (mode === 'paste') {
            emails = parseEmails(pasteText)
        } else if (fileRef.current?.files?.[0]) {
            const file = fileRef.current.files[0]
            const text = await file.text()
            emails = parseEmails(text)
        }

        if (emails.length === 0) {
            setResult({ ok: false, error: 'No valid emails found. Enter one email per line.' })
            return
        }

        if (emails.length > 5000) {
            setResult({ ok: false, error: `Too many emails (${emails.length}). Maximum 5000 per import.` })
            return
        }

        setImporting(true)
        setResult(null)

        try {
            const res = await fetch('/api/admin/email-suppression/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    entries: emails.map(email => ({ email, reason })),
                }),
            })
            const data = await res.json()

            if (res.ok) {
                setResult({
                    ok: true,
                    imported: data.imported,
                    skipped: data.skipped,
                    invalid: data.invalid,
                    invalidEmails: data.invalidEmails,
                })
                if (mode === 'paste') setPasteText('')
            } else {
                setResult({ ok: false, error: data.error || 'Import failed' })
            }
        } catch {
            setResult({ ok: false, error: 'Network error' })
        } finally {
            setImporting(false)
        }
    }

    const REASONS = [
        { value: 'manual', label: '🔒 Manual Block' },
        { value: 'hard_bounce', label: '⛔ Hard Bounce' },
        { value: 'complaint', label: '🚫 Complaint / Spam Report' },
        { value: 'unsubscribe', label: '📧 Unsubscribe' },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {/* Header */}
            <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    📥 Import Suppression List
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Bulk-add email addresses to the suppression list. Suppressed addresses will never receive marketing emails.
                </p>
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: '8px' }}>
                {(['paste', 'file'] as const).map(m => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        style={{
                            padding: '6px 16px',
                            borderRadius: 'var(--radius-md)',
                            border: mode === m ? '1px solid rgba(212,168,83,0.4)' : '1px solid var(--border-subtle)',
                            background: mode === m ? 'rgba(212,168,83,0.08)' : 'var(--bg-secondary)',
                            color: mode === m ? '#d4a853' : 'var(--text-secondary)',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        {m === 'paste' ? '📝 Paste Emails' : '📄 Upload File'}
                    </button>
                ))}
            </div>

            {/* Input area */}
            {mode === 'paste' ? (
                <div>
                    <label style={{
                        display: 'block', fontSize: '0.68rem', fontWeight: 600,
                        color: 'var(--text-tertiary)', marginBottom: '6px',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                        Email Addresses (one per line)
                    </label>
                    <textarea
                        value={pasteText}
                        onChange={e => setPasteText(e.target.value)}
                        placeholder={'user1@example.com\nuser2@example.com\nuser3@example.com'}
                        rows={8}
                        style={{
                            width: '100%',
                            padding: '12px 14px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            fontFamily: 'monospace',
                            resize: 'vertical',
                            outline: 'none',
                        }}
                    />
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                        {parseEmails(pasteText).length} emails detected
                    </div>
                </div>
            ) : (
                <div>
                    <label style={{
                        display: 'block', fontSize: '0.68rem', fontWeight: 600,
                        color: 'var(--text-tertiary)', marginBottom: '6px',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                        Upload CSV or TXT file
                    </label>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,.txt"
                        style={{
                            padding: '10px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)',
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.82rem',
                            width: '100%',
                        }}
                    />
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                        One email per line. CSV files: only the first column is used.
                    </div>
                </div>
            )}

            {/* Reason selector */}
            <div>
                <label style={{
                    display: 'block', fontSize: '0.68rem', fontWeight: 600,
                    color: 'var(--text-tertiary)', marginBottom: '6px',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                    Suppression Reason
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {REASONS.map(r => (
                        <button
                            key={r.value}
                            type="button"
                            onClick={() => setReason(r.value)}
                            style={{
                                padding: '6px 14px',
                                borderRadius: 'var(--radius-md)',
                                border: reason === r.value ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--border-subtle)',
                                background: reason === r.value ? 'rgba(59,130,246,0.08)' : 'var(--bg-secondary)',
                                color: reason === r.value ? '#3b82f6' : 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Import button */}
            <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                style={{
                    padding: '10px 24px',
                    borderRadius: 'var(--radius-md)',
                    background: importing ? 'rgba(212,168,83,0.3)' : 'linear-gradient(135deg, #d4a853, #c49b3a)',
                    border: 'none',
                    color: '#0f1115',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: importing ? 'default' : 'pointer',
                    alignSelf: 'flex-start',
                    transition: 'all 0.2s',
                }}
            >
                {importing ? '⏳ Importing…' : '📥 Import to Suppression List'}
            </button>

            {/* Result */}
            {result && (
                <div style={{
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    background: result.ok ? 'rgba(52,211,153,0.06)' : 'rgba(239,68,68,0.06)',
                    border: `1px solid ${result.ok ? 'rgba(52,211,153,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                    {result.ok ? (
                        <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#10b981', marginBottom: '8px' }}>
                                ✅ Import Complete
                            </div>
                            <div style={{ display: 'flex', gap: '24px', fontSize: '0.78rem' }}>
                                <div>
                                    <span style={{ color: 'var(--text-tertiary)' }}>Imported: </span>
                                    <strong style={{ color: '#10b981' }}>{result.imported}</strong>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-tertiary)' }}>Already suppressed: </span>
                                    <strong style={{ color: 'var(--text-secondary)' }}>{result.skipped}</strong>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-tertiary)' }}>Invalid: </span>
                                    <strong style={{ color: result.invalid ? '#ef4444' : 'var(--text-secondary)' }}>{result.invalid}</strong>
                                </div>
                            </div>
                            {result.invalidEmails && result.invalidEmails.length > 0 && (
                                <div style={{ marginTop: '8px', fontSize: '0.72rem', color: '#ef4444' }}>
                                    Invalid: {result.invalidEmails.join(', ')}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ fontSize: '0.82rem', color: '#ef4444' }}>
                            ❌ {result.error}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
