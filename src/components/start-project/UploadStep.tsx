'use client'

import { useState, useCallback, type ChangeEvent } from 'react'
import { useTranslations } from 'next-intl'
import type { StartProjectFormData } from './StartProjectFlow'

const MAX_FILES = 10
const MAX_SIZE_MB = 10
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024

interface Props {
    form: StartProjectFormData
    updateField: <K extends keyof StartProjectFormData>(field: K, value: StartProjectFormData[K]) => void
    fieldErrors: string[]
}

export default function UploadStep({ form, updateField }: Props) {
    const t = useTranslations('startProject')
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState('')
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
                if (file.size > MAX_SIZE_BYTES) {
                    setUploadError(`${file.name}: ${t('validation.fileTooLarge')}`)
                    continue
                }

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
                    continue
                }

                // Upload directly to R2
                await fetch(signed.presignedUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': file.type },
                    body: file,
                })

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
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    return (
        <section>
            <h2 className="sp-step-title">{t('steps.uploads')}</h2>
            <p className="sp-step-subtitle">{t('helpers.uploadHint')}</p>

            {/* Drop zone */}
            <label style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '160px',
                marginTop: 'var(--space-lg)',
                padding: 'var(--space-xl)',
                borderRadius: 'var(--radius-lg)',
                border: '2px dashed rgba(212,168,83,0.3)',
                background: 'rgba(255,255,255,0.03)',
                cursor: uploading ? 'wait' : 'pointer',
                textAlign: 'center',
                transition: 'border-color 0.2s',
            }}>
                <span style={{ fontSize: '2rem', marginBottom: '8px' }}>
                    {uploading ? '⏳' : '📁'}
                </span>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {uploading ? t('helpers.uploading') : t('fields.uploads')}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    {t('helpers.uploadTypes')} · {MAX_SIZE_MB} MB max · {MAX_FILES - uploads.length} {t('helpers.remaining')}
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
                                    {formatSize(file.size)}
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
