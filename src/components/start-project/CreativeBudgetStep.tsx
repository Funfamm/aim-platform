'use client'

import { useState, useCallback, type ChangeEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useIsMobile } from '@/hooks/useIsMobile'
import {
    TONE_OPTIONS, MAX_TONES, VISUAL_STYLE_OPTIONS,
    BUDGET_OPTIONS, ASPECT_OPTIONS, ADDON_OPTIONS,
    MAX_FILES, MAX_VIDEO_MB, MAX_AUDIO_MB, MAX_OTHER_MB,
} from './constants'
import type { StartProjectFormData } from './StartProjectFlow'

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

export default function CreativeBudgetStep({ form, updateField, fieldErrors }: Props) {
    const t = useTranslations('startProject')
    const isMobile = useIsMobile()

    // Simple open/close — no locking
    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => ({
        creativeDirection: true,
        budgetDelivery: true,
        attachments: !isMobile,
    }))

    const toggle = (id: string) => setOpenSections(prev => ({ ...prev, [id]: !prev[id] }))

    const hasError = (field: string) => fieldErrors.includes(field)

    // ── Tone ────────────────────────────────────────────────────────────
    const toggleTone = (tone: string) => {
        const current = form.tone
        if (current.includes(tone)) {
            updateField('tone', current.filter(t => t !== tone))
        } else if (current.length < MAX_TONES) {
            updateField('tone', [...current, tone])
        }
    }
    const atLimit = form.tone.length >= MAX_TONES

    // ── Visual style ────────────────────────────────────────────────────
    const [showOtherStyle, setShowOtherStyle] = useState(
        () => form.visualStyle !== '' && !VISUAL_STYLE_OPTIONS.includes(form.visualStyle)
    )

    // ── Add-ons ─────────────────────────────────────────────────────────
    const toggleAddon = (addon: string) => {
        const current = form.addOns
        updateField('addOns', current.includes(addon) ? current.filter(a => a !== addon) : [...current, addon])
    }

    // ── File uploads ────────────────────────────────────────────────────
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState('')
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})
    const uploads = form.uploads

    const handleFiles = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || [])
        if (!files.length) return
        if (uploads.length + files.length > MAX_FILES) { setUploadError(t('validation.maxFiles')); return }
        setUploading(true); setUploadError('')
        try {
            const newUploads = [...uploads]
            for (const file of files) {
                const { maxBytes, label } = getMaxSizeForFile(file)
                if (file.size > maxBytes) { setUploadError(t('errors.fileExceedsLimit', { name: file.name, limit: label })); continue }
                const fileId = `${file.name}-${Date.now()}`
                setUploadProgress(prev => ({ ...prev, [fileId]: 0 }))
                const presign = await fetch('/api/upload/presign', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size, kind: 'project-asset', clientEmail: form.email, projectType: form.projectType }),
                })
                const signed = await presign.json()
                if (!presign.ok) { setUploadError(signed.error || t('errors.uploadFailed')); setUploadProgress(prev => { const n = { ...prev }; delete n[fileId]; return n }); continue }
                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest()
                    xhr.open('PUT', signed.presignedUrl, true)
                    xhr.setRequestHeader('Content-Type', file.type)
                    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(prev => ({ ...prev, [fileId]: Math.round((e.loaded / e.total) * 100) })) }
                    xhr.onload = () => { if (xhr.status >= 200 && xhr.status < 300) resolve(); else reject(new Error(`Upload failed: ${xhr.status}`)) }
                    xhr.onerror = () => reject(new Error('Network error'))
                    xhr.send(file)
                })
                setUploadProgress(prev => { const n = { ...prev }; delete n[fileId]; return n })
                newUploads.push({ key: signed.r2Key, url: signed.finalUrl || '', name: file.name, type: file.type, size: file.size })
            }
            updateField('uploads', newUploads)
        } catch { setUploadError(t('errors.uploadFailedRetry')) }
        finally { setUploading(false); setUploadProgress({}); event.target.value = '' }
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
            <h2 className="sp-step-title">{t('stepLabels.creative')}</h2>

            {/* ── Creative Direction ── */}
            <SectionAccordion id="creativeDirection" icon="🎨" title={t('sections.creativeDirection')} isOpen={openSections.creativeDirection} onToggle={() => toggle('creativeDirection')}>
                <div className="sp-form-stack">
                    {/* Tone */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <label className="sp-label" style={{ marginBottom: 0 }}>{t('fields.tone')}</label>
                            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: atLimit ? 'var(--accent-gold)' : 'var(--text-tertiary)' }}>
                                {form.tone.length} / {MAX_TONES}
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                            {TONE_OPTIONS.map(tone => {
                                const active = form.tone.includes(tone)
                                const disabled = !active && atLimit
                                return (
                                    <button key={tone} type="button" onClick={() => toggleTone(tone)} disabled={disabled} className="sp-tone-pill" data-active={active || undefined}
                                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, border: `1px solid ${active ? 'rgba(212,168,83,0.5)' : 'var(--border-subtle)'}`, background: active ? 'rgba(212,168,83,0.12)' : 'rgba(255,255,255,0.04)', color: active ? 'var(--accent-gold)' : disabled ? 'rgba(255,255,255,0.2)' : 'var(--text-secondary)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'all 0.15s' }}>
                                        {t(`tones.${tone}`)}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Visual Style */}
                    <div>
                        <label className="sp-label" htmlFor="sp-visualStyle">{t('fields.visualStyle')}</label>
                        <select id="sp-visualStyle" className="sp-input"
                            value={VISUAL_STYLE_OPTIONS.includes(form.visualStyle) ? form.visualStyle : showOtherStyle ? 'other' : ''}
                            onChange={e => {
                                if (e.target.value === 'other') { updateField('visualStyle', ''); setShowOtherStyle(true); setTimeout(() => document.getElementById('sp-visualStyleOther')?.focus(), 50) }
                                else { updateField('visualStyle', e.target.value); setShowOtherStyle(false) }
                            }}
                            style={{ appearance: 'auto' }}>
                            <option value="">— {t('fields.visualStyle')} —</option>
                            {VISUAL_STYLE_OPTIONS.map(opt => (<option key={opt} value={opt}>{t(`visualStyles.${opt}`)}</option>))}
                            <option value="other">{t('fields.other') || 'Other'}</option>
                        </select>
                        {showOtherStyle && (
                            <input id="sp-visualStyleOther" className="sp-input" style={{ marginTop: '8px' }} placeholder={t('fields.describeStyle') || 'Describe your preferred style...'} value={form.visualStyle} onChange={e => updateField('visualStyle', e.target.value)} />
                        )}
                    </div>

                    {/* Inspiration, avoid, feeling */}
                    <div>
                        <label className="sp-label" htmlFor="sp-inspirationLinks">{t('fields.inspirationLinks')}</label>
                        <textarea id="sp-inspirationLinks" className="sp-input" style={{ minHeight: '80px', resize: 'vertical' }} placeholder="https://youtube.com/watch?v=..." value={form.inspirationLinks.join('\n')} onChange={e => updateField('inspirationLinks', e.target.value.split('\n').map(s => s.trim()).filter(Boolean))} />
                    </div>
                    <div>
                        <label className="sp-label" htmlFor="sp-avoidNotes">{t('fields.avoidNotes')}</label>
                        <textarea id="sp-avoidNotes" className="sp-input" style={{ minHeight: '80px', resize: 'vertical' }} placeholder={t('fields.avoidNotes')} value={form.avoidNotes} onChange={e => updateField('avoidNotes', e.target.value)} />
                    </div>
                    <div>
                        <label className="sp-label" htmlFor="sp-emotionalFeeling">{t('fields.emotionalFeeling')}</label>
                        <input id="sp-emotionalFeeling" className="sp-input" placeholder={t('fields.emotionalFeeling')} value={form.emotionalFeeling} onChange={e => updateField('emotionalFeeling', e.target.value)} />
                    </div>
                </div>
            </SectionAccordion>

            {/* ── Budget & Delivery ── */}
            <SectionAccordion id="budgetDelivery" icon="💰" title={t('sections.budgetDelivery')} isOpen={openSections.budgetDelivery} onToggle={() => toggle('budgetDelivery')}>
                <div className="sp-form-stack">
                    <div>
                        <label className="sp-label" htmlFor="sp-budget">{t('fields.budgetRange')} *</label>
                        {hasError('budgetRange') && <p className="sp-error" style={{ marginBottom: '6px' }}>{t('validation.required')}</p>}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                            {BUDGET_OPTIONS.map(opt => {
                                const active = form.budgetRange === opt
                                return (
                                    <button key={opt} type="button" onClick={() => updateField('budgetRange', active ? '' : opt)}
                                        style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, border: `1px solid ${active ? 'rgba(212,168,83,0.5)' : hasError('budgetRange') ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}`, background: active ? 'rgba(212,168,83,0.12)' : 'rgba(255,255,255,0.04)', color: active ? 'var(--accent-gold)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}>
                                        {t(`budgetOptions.${opt}`)}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div>
                        <label className="sp-label">{t('fields.aspectRatio')}</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                            {ASPECT_OPTIONS.map(opt => {
                                const active = form.aspectRatio === opt
                                return (
                                    <button key={opt} type="button" onClick={() => updateField('aspectRatio', active ? '' : opt)}
                                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, border: `1px solid ${active ? 'rgba(129,140,248,0.5)' : 'var(--border-subtle)'}`, background: active ? 'rgba(129,140,248,0.12)' : 'rgba(255,255,255,0.04)', color: active ? '#818cf8' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}>
                                        {t(`aspectOptions.${opt}`)}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    <div className="sp-form-grid-2">
                        <div>
                            <label className="sp-label" htmlFor="sp-deliveryPlatform">{t('fields.deliveryPlatform')}</label>
                            <input id="sp-deliveryPlatform" className="sp-input" placeholder={t('helpers.platformPlaceholder')} value={form.deliveryPlatform} onChange={e => updateField('deliveryPlatform', e.target.value)} />
                        </div>
                        <div>
                            <label className="sp-label" htmlFor="sp-duration">{t('fields.duration')}</label>
                            <input id="sp-duration" className="sp-input" placeholder={t('helpers.durationPlaceholder')} value={form.duration} onChange={e => updateField('duration', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className="sp-label">{t('fields.addOns')}</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                            {ADDON_OPTIONS.map(addon => {
                                const active = form.addOns.includes(addon)
                                return (
                                    <button key={addon} type="button" onClick={() => toggleAddon(addon)}
                                        style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600, border: `1px solid ${active ? 'rgba(52,211,153,0.5)' : 'var(--border-subtle)'}`, background: active ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)', color: active ? '#34d399' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}>
                                        {t(`addonOptions.${addon}`)}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </SectionAccordion>

            {/* ── Attachments ── */}
            <SectionAccordion id="attachments" icon="📎" title={t('sections.attachments')} isOpen={openSections.attachments} onToggle={() => toggle('attachments')}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {[
                        { icon: '🎬', label: t('helpers.videoLimit'), color: '#818cf8' },
                        { icon: '🎵', label: t('helpers.audioLimit'), color: '#22c55e' },
                        { icon: '🖼️', label: t('helpers.docLimit'), color: '#f59e0b' },
                    ].map(b => (
                        <span key={b.label} style={{ fontSize: '0.65rem', padding: '4px 10px', borderRadius: '20px', background: `${b.color}11`, border: `1px solid ${b.color}22`, color: b.color }}>{b.icon} {b.label}</span>
                    ))}
                </div>
                <label className="sp-dropzone" style={{ cursor: uploading ? 'wait' : 'pointer' }}>
                    <span style={{ fontSize: '2rem', marginBottom: '8px' }}>{uploading ? '⏳' : '📁'}</span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{uploading ? t('helpers.uploading') : t('fields.uploads')}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>{t('helpers.uploadTypes')} · {MAX_FILES - uploads.length} {t('helpers.remaining')}</span>
                    <input type="file" multiple disabled={uploading} onChange={handleFiles} accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.zip" style={{ display: 'none' }} />
                </label>
                {activeProgress.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'var(--space-sm)' }}>
                        {activeProgress.map(([id, pct]) => (
                            <div key={id} style={{ padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                    <span>{t('helpers.uploading')}</span><span style={{ fontWeight: 700, color: '#818cf8' }}>{pct}%</span>
                                </div>
                                <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: '2px', background: 'linear-gradient(90deg, #818cf8, #6366f1)', transition: 'width 0.3s ease' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {uploadError && <p className="sp-error" style={{ marginTop: 'var(--space-sm)' }}>{uploadError}</p>}
                {uploads.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'var(--space-md)' }}>
                        {uploads.map((file, index) => (
                            <div key={`${file.key}-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-subtle)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                                    <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{fileIcon(file.type)}</span>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{fileCategory(file.type)} · {formatSize(file.size)}</div>
                                    </div>
                                </div>
                                <button type="button" onClick={() => removeUpload(index)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '1rem', padding: '4px 8px', flexShrink: 0 }}>✕</button>
                            </div>
                        ))}
                    </div>
                )}
            </SectionAccordion>
        </section>
    )
}

// Simple accordion — no locking logic
function SectionAccordion({ id, icon, title, isOpen, onToggle, children }: {
    id: string; icon: string; title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode
}) {
    return (
        <div id={`section-${id}`} className="sp-accordion" style={{ marginTop: 'var(--space-md)' }}>
            <h3 style={{ margin: 0 }}>
                <button id={`section-${id}-trigger`} type="button" aria-expanded={isOpen} aria-controls={`section-${id}-body`} onClick={onToggle}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '14px 16px', minHeight: '48px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', background: isOpen ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'all 0.2s', WebkitTapHighlightColor: 'transparent', fontSize: '0.88rem', fontWeight: 700, color: isOpen ? 'var(--accent-gold)' : 'var(--text-primary)', textAlign: 'left' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span>{icon}</span><span>{title}</span></span>
                    <span style={{ transition: 'transform 0.25s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>▾</span>
                </button>
            </h3>
            <div id={`section-${id}-body`} role="region" aria-labelledby={`section-${id}-trigger`}
                style={{ maxHeight: isOpen ? '5000px' : '0', overflow: 'hidden', transition: 'max-height 0.35s ease, opacity 0.25s ease', opacity: isOpen ? 1 : 0 }}>
                <div style={{ padding: 'var(--space-md) 0' }}>{children}</div>
            </div>
        </div>
    )
}
