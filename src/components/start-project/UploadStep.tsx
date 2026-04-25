'use client'

import { useState, useCallback, type ChangeEvent } from 'react'
import { useTranslations } from 'next-intl'
import type { StartProjectFormData } from './StartProjectFlow'

const MAX_FILES = 10
const MAX_VIDEO_MB = 500
const MAX_AUDIO_MB = 50
const MAX_OTHER_MB = 10

function getMaxSizeForFile(file: File): { maxBytes: number; label: string } {
    if (file.type.startsWith('video/')) return { maxBytes: MAX_VIDEO_MB * 1024 * 1024, label: `${MAX_VIDEO_MB} MB` }
    if (file.type.startsWith('audio/')) return { maxBytes: MAX_AUDIO_MB * 1024 * 1024, label: `${MAX_AUDIO_MB} MB` }
    return { maxBytes: MAX_OTHER_MB * 1024 * 1024, label: `${MAX_OTHER_MB} MB` }
}

function fileIcon(type: string): string {
    if (type.startsWith('video/')) return '🎬'
    if (type.startsWith('audio/')) return '🎵'
    if (type.startsWith('image/')) return '🖼️'
    if (type.includes('pdf')) return '📄'
    if (type.includes('zip')) return '📦'
    return '📎'
}

function fileCategory(type: string): string {
    if (type.startsWith('video/')) return 'Video'
    if (type.startsWith('audio/')) return 'Audio'
    if (type.startsWith('image/')) return 'Image'
    if (type.includes('pdf')) return 'PDF'
    return 'File'
}

interface Props {
    form: StartProjectFormData
    updateField: <K extends keyof StartProjectFormData>(field: K, value: StartProjectFormData[K]) => void
    fieldErrors: string[]
}

export default function UploadStep({ form, updateField }: Props) {
    const t = useTranslations('startProject')
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState('')
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
    const uploads = form.uploads

    const handleFiles = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || [])
        if (!files.length) return

        // Check total file limit
        if (uploads.length + files.length > MAX_FILES) {
            setUploadError(t('validation.maxFiles'))
            return
        }

        setUploading(true)
        setUploadError('')

        try {
            const newUploads = [...uploads]

            for (const file of files) {
                const { maxBytes, label } = getMaxSizeForFile(file)
                if (file.size > maxBytes) {
                    setUploadError(`${file.name}: File exceeds ${label} limit`)
                    continue
                }

                // Track progress for this file
                const fileId = `${file.name}-${Date.now()}`
                setUploadProgress(prev => ({ ...prev, [fileId]: 0 }))

                // Get presigned URL
                const presign = await fetch('/api/upload/presign', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        kind: 'project-asset',
                        clientEmail: form.email,
                        projectType: form.projectType,
                    }),
                })

                const signed = await presign.json()
                if (!presign.ok) {
                    setUploadError(signed.error || 'Upload failed')
                    setUploadProgress(prev => { const n = { ...prev }; delete n[fileId]; return n })
                    continue
                }

                // Upload directly to R2 with progress tracking via XMLHttpRequest
                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest()
                    xhr.open('PUT', signed.presignedUrl, true)
                    xhr.setRequestHeader('Content-Type', file.type)

                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            const pct = Math.round((e.loaded / e.total) * 100)
                            setUploadProgress(prev => ({ ...prev, [fileId]: pct }))
                        }
                    }

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) resolve()
                        else reject(new Error(`Upload failed: ${xhr.status}`))
                    }
                    xhr.onerror = () => reject(new Error('Network error'))
                    xhr.send(file)
                })

                setUploadProgress(prev => { const n = { ...prev }; delete n[fileId]; return n })

                newUploads.push({
                    key: signed.r2Key,
                    url: signed.finalUrl || '',
                    name: file.name,
                    type: file.type,
                    size: file.size,
                })
            }

            updateField('uploads', newUploads)
        } catch {
            setUploadError('Upload failed. Please try again.')
        } finally {
            setUploading(false)
            setUploadProgress({})
            // Reset input so re-selecting same file works
            event.target.value = ''
        }
    }, [uploads, form.email, form.projectType, updateField, t])

    const removeUpload = useCallback((index: number) => {
        updateField('uploads', uploads.filter((_, i) => i !== index))
    }, [uploads, updateField])

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    }

    const activeProgress = Object.entries(uploadProgress)

    return (
        <section>
            <h2 className="sp-step-title">{t('steps.uploads')}</h2>
            <p className="sp-step-subtitle">{t('helpers.uploadHint')}</p>

            {/* Size info badges */}
            <div style={{
                display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px',
            }}>
                {[
                    { icon: '🎬', label: `Video: up to ${MAX_VIDEO_MB} MB`, color: '#818cf8' },
                    { icon: '🎵', label: `Audio: up to ${MAX_AUDIO_MB} MB`, color: '#22c55e' },
                    { icon: '🖼️', label: `Images/Docs: up to ${MAX_OTHER_MB} MB`, color: '#f59e0b' },
                ].map(b => (
                    <span key={b.label} style={{
                        fontSize: '0.65rem', padding: '4px 10px', borderRadius: '20px',
                        background: `${b.color}11`, border: `1px solid ${b.color}22`, color: b.color,
                    }}>
                        {b.icon} {b.label}
                    </span>
                ))}
            </div>

            {/* Drop zone */}
            <label className="sp-dropzone" style={{
                cursor: uploading ? 'wait' : 'pointer',
            }}>
                <span style={{ fontSize: '2rem', marginBottom: '8px' }}>
                    {uploading ? '⏳' : '📁'}
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {uploading ? t('helpers.uploading') : t('fields.uploads')}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    {t('helpers.uploadTypes')} · {MAX_FILES - uploads.length} {t('helpers.remaining')}
                </span>
                <input
                    type="file"
                    multiple
                    disabled={uploading}
                    onChange={handleFiles}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip"
                    style={{ display: 'none' }}
                />
            </label>

            {/* Upload progress */}
            {activeProgress.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'var(--space-sm)' }}>
                    {activeProgress.map(([id, pct]) => (
                        <div key={id} style={{
                            padding: '8px 12px', borderRadius: 'var(--radius-md)',
                            background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                <span>Uploading…</span>
                                <span style={{ fontWeight: 700, color: '#818cf8' }}>{pct}%</span>
                            </div>
                            <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', width: `${pct}%`, borderRadius: '2px',
                                    background: 'linear-gradient(90deg, #818cf8, #6366f1)',
                                    transition: 'width 0.3s ease',
                                }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Error */}
            {uploadError && (
                <p className="sp-error" style={{ marginTop: 'var(--space-sm)' }}>{uploadError}</p>
            )}

            {/* Uploaded files list */}
            {uploads.length > 0 && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    marginTop: 'var(--space-md)',
                }}>
                    {uploads.map((file, index) => (
                        <div key={`${file.key}-${index}`} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid var(--border-subtle)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{fileIcon(file.type)}</span>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{
                                        fontSize: '0.82rem',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {file.name}
                                    </div>
                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                                        {fileCategory(file.type)} · {formatSize(file.size)}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => removeUpload(index)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-tertiary)',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    padding: '4px 8px',
                                    flexShrink: 0,
                                }}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </section>
    )
}
