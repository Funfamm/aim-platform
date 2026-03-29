'use client'

import { useState, useRef, useCallback } from 'react'

interface FileUploaderProps {
    accept?: string         // e.g. "image/*" or "audio/*"
    category?: string       // folder category: 'covers', 'trailers', 'films'
    currentUrl?: string     // existing URL to show
    onUpload: (url: string) => void
    label?: string
    maxSizeMB?: number
    compact?: boolean       // smaller size for inline use
}

export default function FileUploader({
    accept = 'image/*',
    category = 'general',
    currentUrl = '',
    onUpload,
    label = 'Upload File',
    maxSizeMB = 50,
    compact = false,
}: FileUploaderProps) {
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [error, setError] = useState('')
    const [dragOver, setDragOver] = useState(false)
    const [preview, setPreview] = useState(currentUrl)
    const inputRef = useRef<HTMLInputElement>(null)

    const isImage = (url: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(url)
    const isVideo = (url: string) => /\.(mp4|webm|mov|avi)$/i.test(url)

    // URL sanitisation — block dangerous schemes
    const isUrlSafe = (url: string): boolean => {
        const trimmed = url.trim()
        if (!trimmed) return true
        if (trimmed.length > 2000) return false
        const lower = trimmed.toLowerCase()
        const dangerous = ['javascript:', 'data:', 'blob:', 'file:', 'vbscript:']
        if (dangerous.some(s => lower.startsWith(s))) return false
        return trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('/')
    }

    const uploadFile = useCallback(async (file: File) => {
        setError('')

        // Size check
        if (file.size > maxSizeMB * 1024 * 1024) {
            setError(`File too large. Maximum ${maxSizeMB}MB.`)
            return
        }

        setUploading(true)
        setProgress(10)

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('category', category)

            // Simulate progress (we can't get real progress with fetch)
            const progressTimer = setInterval(() => {
                setProgress(p => Math.min(p + 10, 90))
            }, 300)

            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                body: formData,
            })

            clearInterval(progressTimer)

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Upload failed')
            }

            const data = await res.json()
            setProgress(100)
            setPreview(data.url)
            onUpload(data.url)

            // Reset progress after a moment
            setTimeout(() => setProgress(0), 1000)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Upload failed')
            setProgress(0)
        } finally {
            setUploading(false)
        }
    }, [category, maxSizeMB, onUpload])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file) uploadFile(file)
    }, [uploadFile])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) uploadFile(file)
    }

    const height = compact ? '100px' : '160px'

    return (
        <div style={{ marginBottom: 'var(--space-sm)' }}>
            {label && (
                <div style={{
                    fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)',
                    marginBottom: '6px', letterSpacing: '0.03em',
                }}>{label}</div>
            )}

            {/* Drop zone */}
            <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                style={{
                    position: 'relative',
                    height,
                    border: `2px dashed ${dragOver ? 'var(--accent-gold)' : error ? 'var(--color-error)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-lg)',
                    background: dragOver ? 'rgba(212,168,83,0.05)' : preview ? 'var(--bg-primary)' : 'var(--bg-secondary)',
                    cursor: uploading ? 'default' : 'pointer',
                    overflow: 'hidden',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {/* Preview */}
                {preview && !uploading && (
                    <>
                        {isImage(preview) && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={preview} alt="Preview"
                                style={{
                                    position: 'absolute', inset: 0,
                                    width: '100%', height: '100%',
                                    objectFit: 'cover', opacity: 0.4,
                                }}
                            />
                        )}
                        {isVideo(preview) && (
                            <video
                                src={preview} muted
                                style={{
                                    position: 'absolute', inset: 0,
                                    width: '100%', height: '100%',
                                    objectFit: 'cover', opacity: 0.3,
                                }}
                            />
                        )}
                    </>
                )}

                {/* Upload UI */}
                <div style={{
                    position: 'relative', zIndex: 1,
                    textAlign: 'center', padding: 'var(--space-md)',
                }}>
                    {uploading ? (
                        <>
                            <div style={{
                                width: compact ? '120px' : '200px', height: '4px',
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '2px', overflow: 'hidden',
                                margin: '0 auto var(--space-sm)',
                            }}>
                                <div style={{
                                    height: '100%', width: `${progress}%`,
                                    background: 'var(--accent-gold)',
                                    borderRadius: '2px',
                                    transition: 'width 0.3s ease',
                                }} />
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                Uploading... {progress}%
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: compact ? '1.2rem' : '1.8rem', marginBottom: '4px', opacity: 0.4 }}>
                                {preview ? '🔄' : '📁'}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                {preview ? 'Click or drop to replace' : 'Drag & drop or click to browse'}
                            </div>
                            {!compact && (
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                    {accept.includes('video') ? 'Images & Videos' : accept.includes('audio') ? 'Audio files' : 'Images only'} • Max {maxSizeMB}MB
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Current URL display */}
                {preview && !uploading && (
                    <div style={{
                        position: 'absolute', bottom: '6px', left: '8px', right: '8px',
                        fontSize: '0.6rem', color: 'var(--accent-gold)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        background: 'rgba(0,0,0,0.6)', padding: '2px 6px',
                        borderRadius: '4px', zIndex: 2,
                    }}>
                        {preview}
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div style={{
                    fontSize: '0.75rem', color: 'var(--color-error)', marginTop: '4px',
                }}>⚠️ {error}</div>
            )}

            {/* Hidden file input */}
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                onChange={handleFileSelect}
                style={{ display: 'none' }}
            />

            {/* URL input fallback */}
            <div style={{
                display: 'flex', gap: '4px', marginTop: '6px',
            }}>
                <input
                    type="text"
                    placeholder="Or paste a URL (https://...)"
                    value={preview}
                    onChange={e => {
                        const val = e.target.value
                        if (val && !isUrlSafe(val)) {
                            setError('Invalid URL. Must start with https://, http://, or /')
                            return
                        }
                        setError('')
                        setPreview(val)
                        onUpload(val)
                    }}
                    style={{
                        flex: 1, padding: '0.4rem 0.6rem',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        color: 'var(--text-primary)',
                        fontSize: '0.75rem',
                    }}
                />
                {preview && (
                    <button
                        type="button"
                        onClick={() => { setPreview(''); onUpload('') }}
                        style={{
                            padding: '0.4rem 0.6rem', border: 'none',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(239,68,68,0.1)', color: 'var(--color-error)',
                            fontSize: '0.7rem', cursor: 'pointer',
                        }}
                    >✕</button>
                )}
            </div>
        </div>
    )
}
