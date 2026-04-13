'use client'

import { useState, useRef } from 'react'

interface AdminImageUploadProps {
    value: string
    onChange: (url: string) => void
    category?: string
    label?: string
    hint?: string
    previewSize?: number
}

/**
 * Reusable admin image upload widget.
 * - Drag & drop or click to browse
 * - Instant preview thumbnail
 * - Upload progress bar
 * - Fallback manual URL input
 * - Uses /api/admin/upload (admin-auth gated, R2 backed)
 */
export default function AdminImageUpload({
    value,
    onChange,
    category = 'general',
    label = 'Image',
    hint = 'Recommended: 1200×628px JPG or PNG',
    previewSize = 80,
}: AdminImageUploadProps) {
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState('')
    const [drag, setDrag] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    async function uploadFile(file: File) {
        setError('')
        setUploading(true)
        setProgress(10)
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('category', category)
            setProgress(40)
            const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
            setProgress(80)
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Upload failed')
            onChange(data.url)
            setProgress(100)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed')
        } finally {
            setUploading(false)
            setTimeout(() => setProgress(0), 600)
        }
    }

    function handleFiles(files: FileList | null) {
        if (!files?.length) return
        const file = files[0]
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file (JPG, PNG, WebP)')
            return
        }
        if (file.size > 10 * 1024 * 1024) {
            setError('Image too large — maximum 10MB')
            return
        }
        uploadFile(file)
    }

    return (
        <div>
            <label style={{
                display: 'block', fontSize: '0.7rem', fontWeight: 700, marginBottom: '10px',
                color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em',
            }}>
                {label}
            </label>

            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Preview box */}
                <div
                    onClick={() => !uploading && inputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDrag(true) }}
                    onDragLeave={() => setDrag(false)}
                    onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files) }}
                    style={{
                        width: previewSize, height: previewSize, flexShrink: 0,
                        borderRadius: '10px', overflow: 'hidden',
                        border: `2px dashed ${drag ? 'var(--accent-gold)' : value ? 'rgba(52,211,153,0.4)' : 'var(--border-subtle)'}`,
                        background: drag ? 'rgba(212,168,83,0.06)' : 'rgba(255,255,255,0.02)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: uploading ? 'wait' : 'pointer',
                        transition: 'all 0.2s', position: 'relative',
                    }}
                    title="Click or drag an image to upload"
                >
                    {value
                        ? <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        : <span style={{ fontSize: '1.4rem', opacity: 0.4 }}>🖼️</span>
                    }
                    {uploading && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            background: 'rgba(0,0,0,0.6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexDirection: 'column', gap: '5px',
                        }}>
                            <div style={{ width: '60%', height: '3px', background: 'rgba(255,255,255,0.15)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent-gold)', transition: 'width 0.3s', borderRadius: '2px' }} />
                            </div>
                            <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.7)' }}>Uploading…</span>
                        </div>
                    )}
                </div>

                {/* Controls */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {/* Upload button */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            disabled={uploading}
                            onClick={() => inputRef.current?.click()}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: '6px',
                                padding: '7px 14px', borderRadius: '8px',
                                background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.25)',
                                color: 'var(--accent-gold)', fontSize: '0.78rem', fontWeight: 600,
                                cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1,
                            }}
                        >
                            📁 {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
                        </button>
                        {value && (
                            <button
                                type="button"
                                onClick={() => onChange('')}
                                style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                                    padding: '7px 12px', borderRadius: '8px',
                                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                                    color: '#ef4444', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                ✕ Remove
                            </button>
                        )}
                    </div>

                    {/* Hidden file input */}
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ display: 'none' }}
                        onChange={e => handleFiles(e.target.files)}
                    />

                    {/* Fallback URL input */}
                    <input
                        type="text"
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        placeholder="Or paste a URL — https://…"
                        style={{
                            width: '100%', padding: '8px 12px', borderRadius: '8px',
                            border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)',
                            color: 'var(--text-primary)', fontSize: '0.8rem', outline: 'none',
                            boxSizing: 'border-box', fontFamily: 'inherit',
                        }}
                    />

                    {/* Hint / error */}
                    {error
                        ? <div style={{ fontSize: '0.68rem', color: '#ef4444' }}>⚠️ {error}</div>
                        : <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{hint}</div>
                    }
                </div>
            </div>
        </div>
    )
}
