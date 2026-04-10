'use client'

import { useState, useRef } from 'react'
import ApplicationSuccess from '@/components/application/ApplicationSuccess'
import VoiceRecorder from '@/components/application/VoiceRecorder'
import { useTranslations, useLocale } from 'next-intl'

interface CastingCallInfo {
    id: string
    roleName: string
    roleType: string
    roleDescription: string
    ageRange: string | null
    gender: string | null
    requirements: string
    project: {
        title: string
        genre: string | null
    }
}

const PHOTO_SLOT_KEYS = [
    { key: 'front_headshot', labelKey: 'photoFrontHeadshot', descKey: 'photoFrontDesc', required: true },
    { key: 'side_profile', labelKey: 'photoSideProfile', descKey: 'photoSideDesc', required: true },
    { key: 'full_body', labelKey: 'photoFullBody', descKey: 'photoFullDesc', required: true },
    { key: 'expression', labelKey: 'photoExpression', descKey: 'photoExpressionDesc', required: true },
    { key: 'optional_1', labelKey: 'photoOptional1', descKey: 'photoOptional1Desc', required: false },
    { key: 'optional_2', labelKey: 'photoOptional2', descKey: 'photoOptional2Desc', required: false },
]

const SOCIAL_PLATFORMS = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'youtube', label: 'YouTube' },
    { value: 'x', label: 'X (Twitter)' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'imdb', label: 'IMDb' },
    { value: 'backstage', label: 'Backstage' },
    { value: 'other', label: 'Other' },
]

const PERSONALITY_QUESTIONS = [
    {
        key: 'describe_yourself',
        label: 'Describe yourself in three words',
        type: 'text' as const,
        placeholder: 'e.g., Bold, creative, empathetic',
    },
    {
        key: 'why_acting',
        label: 'What draws you to apply?',
        type: 'textarea' as const,
        placeholder: 'Tell us what sparks your interest...',
    },
    {
        key: 'dream_role',
        label: "What's your dream role?",
        type: 'textarea' as const,
        placeholder: 'A genre, character type, or scenario...',
    },
]

const CONSENT_ITEMS = [
    {
        key: 'consent_media',
        text: 'I give AIM Studio a permanent, irrevocable right to use my photos, voice, video, and submissions for this project and its promotion. This includes AI-generated content using my likeness. This right remains even if I leave the project.',
    },
    {
        key: 'consent_voluntary',
        text: 'I understand my participation is voluntary with no pay unless agreed in writing. I waive any future claims over materials I submit or content made during my involvement.',
    },
    {
        key: 'consent_privacy',
        text: 'I confirm my information is accurate. My contact details can be removed on request, but all production content and materials from my involvement belong to AIM Studio permanently.',
    },
]

export default function ApplicationForm({ castingCall, isAdmin = false }: { castingCall: CastingCallInfo; isAdmin?: boolean }) {
    const t = useTranslations('castingForm')
    const locale = useLocale()
    const [step, setStep] = useState(1)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState('')

    // Form state
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        age: '',
        gender: '',
        location: '',
        experience: '',
        specialSkills: '',
        // Personality
        describe_yourself: '',
        why_acting: '',
        dream_role: '',
        unique_quality: '',
        // Social media
        socialPlatform: 'instagram',
        socialUsername: '',
        socialPlatform2: '',
        socialUsername2: '',
    })

    const [photos, setPhotos] = useState<Record<string, File | null>>({
        front_headshot: null,
        side_profile: null,
        full_body: null,
        expression: null,
        optional_1: null,
        optional_2: null,
    })

    const [audioFile, setAudioFile] = useState<File | null>(null)
    const [consents, setConsents] = useState({ consent_media: false, consent_voluntary: false, consent_privacy: false })
    // Track per-file upload progress (0–100)
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)

    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

    const totalSteps = 5

    const updateField = (key: string, value: string) => {
        setFormData((prev) => ({ ...prev, [key]: value }))
    }

    // Map file extension → MIME when the browser reports nothing (common for HEIC on iOS)
    const inferMime = (file: File): string => {
        if (file.type && file.type !== 'application/octet-stream') return file.type
        const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
        const map: Record<string, string> = {
            jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
            webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
            mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav',
            webm: 'audio/webm', ogg: 'audio/ogg', flac: 'audio/flac',
            aac: 'audio/aac', mp4: 'audio/mp4',
        }
        return map[ext] || file.type || 'application/octet-stream'
    }

    const handlePhotoChange = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.size > 10 * 1024 * 1024) {
            setError(t('imageTooLarge'))
            return
        }
        const mime = inferMime(file)
        if (!mime.startsWith('image/')) {
            setError(t('invalidImage'))
            return
        }
        setError('')
        setPhotos((prev) => ({ ...prev, [key]: file }))
    }

    const requiredPhotosCount = Object.entries(photos).filter(([key, file]) => {
        const slot = PHOTO_SLOT_KEYS.find((s) => s.key === key)
        return slot?.required && file !== null
    }).length

    const canProceed = (s: number) => {
        if (isAdmin) return true
        switch (s) {
            case 1:
                return formData.fullName && formData.email && formData.age && formData.gender
            case 2:
                return formData.describe_yourself && formData.why_acting && formData.dream_role
            case 3:
                return requiredPhotosCount >= 4
            case 4:
                return audioFile && formData.socialUsername
            case 5:
                return consents.consent_media && consents.consent_voluntary && consents.consent_privacy
            default:
                return false
        }
    }

    const goToStep = (nextStep: number) => {
        setError('')
        setStep(nextStep)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    /**
     * Upload a single file directly to R2 via a presigned PUT URL.
     * Browser → R2 directly — no Vercel body limit, supports files up to GBs.
     * Requires R2 CORS to allow PUT from the app's domain.
     */
    const uploadFileDirect = async (
        file: File,
        kind: 'image' | 'audio',
        name: string,
    ): Promise<string> => {
        // Use inferred MIME for the presign request (fixes iOS HEIC empty-type issue)
        const mime = inferMime(file)
        const nameSlug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'applicant'
        const category = kind === 'image' ? 'photos' : 'audio'
        const folder = `casting/${nameSlug}/${category}`

        // Strategy 1: Direct browser → R2 via presigned URL (fastest, no Vercel limit)
        try {
            const signRes = await fetch('/api/upload/presign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName: file.name, fileType: mime, kind, name }),
            })
            if (signRes.ok) {
                const { presignedUrl, finalUrl } = await signRes.json()
                const putRes = await fetch(presignedUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': mime },
                    credentials: 'omit', // presigned URL has auth built-in; cookies would break CORS wildcard
                    body: file,
                })
                if (putRes.ok) return finalUrl
                console.warn('[Upload] Direct R2 PUT failed, falling back to stream proxy')
            }
        } catch (e) {
            console.warn('[Upload] Presign/R2 failed, falling back to stream proxy:', e)
        }

        // Strategy 2: Fallback — stream through our server proxy (bypasses CORS)
        const streamRes = await fetch(
            `/api/upload/stream?fileName=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(mime)}&folder=${encodeURIComponent(folder)}&fileSize=${file.size}`,
            { method: 'POST', body: file },
        )
        if (!streamRes.ok) {
            const err = await streamRes.json().catch(() => ({}))
            throw new Error(err.error || `Upload failed: ${file.name}`)
        }
        const { finalUrl } = await streamRes.json()
        return finalUrl
    }


    const handleSubmit = async () => {
        if (!canProceed(5)) return
        setSubmitting(true)
        setError('')
        setUploadProgress(null)

        try {
            const photoEntries = Object.entries(photos).filter(([, f]) => f !== null) as [string, File][]
            const totalUploads = photoEntries.length + (audioFile ? 1 : 0)
            let completed = 0

            setUploadProgress({ current: 0, total: totalUploads })

            // Upload photos directly to R2 (browser → R2, bypasses Vercel — no size limit)
            const photoUrls: Record<string, string> = {}
            for (const [key, file] of photoEntries) {
                photoUrls[key] = await uploadFileDirect(file, 'image', formData.fullName)
                completed++
                setUploadProgress({ current: completed, total: totalUploads })
            }

            // Upload audio directly to R2
            let voiceUrl: string | null = null
            if (audioFile) {
                voiceUrl = await uploadFileDirect(audioFile, 'audio', formData.fullName)
                completed++
                setUploadProgress({ current: completed, total: totalUploads })
            }

            setUploadProgress(null)

            // Submit — only metadata + R2 URLs, no file bytes
            const data = new FormData()
            Object.entries(formData).forEach(([key, value]) => { if (value) data.append(key, value) })
            data.append('castingCallId', castingCall.id)
            data.append('locale', locale)

            for (const [key, url] of Object.entries(photoUrls)) {
                data.append(`photo_${key}`, url)
            }
            if (voiceUrl) data.append('voiceRecording', voiceUrl)
            data.append('consents', JSON.stringify(consents))

            const res = await fetch(`/api/casting/${castingCall.id}/apply`, {
                method: 'POST',
                body: data,
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.error || t('submitError'))
            }

            setSubmitted(true)
        } catch (err: unknown) {
            setUploadProgress(null)
            const rawMsg = err instanceof Error ? err.message : String(err)
            console.error('[ApplicationForm] Submit failed:', rawMsg)
            // Show friendly message to users, technical details only to admins
            if (isAdmin) {
                setError(rawMsg)
            } else {
                setError(t('friendlyUploadError'))
            }
        } finally {
            setSubmitting(false)
        }
    }

    if (submitted) {
        return <ApplicationSuccess roleName={castingCall.roleName} projectTitle={castingCall.project.title} />
    }

    return (
        <div className="apply-form-container">
            {/* Role Info Card */}
            <div className="glass-card" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-2xl)', borderColor: 'var(--border-accent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
                    <div>
                        <span className="text-label">{castingCall.project.title}</span>
                        <h3 style={{ marginTop: '4px' }}>{castingCall.roleName}</h3>
                        <p style={{ fontSize: '0.85rem', marginTop: 'var(--space-sm)' }}>{castingCall.roleDescription}</p>
                    </div>
                    <span className="badge badge-gold">{t({ lead: 'roleTypeLead', supporting: 'roleTypeSupporting', extra: 'roleTypeExtra' }[castingCall.roleType.toLowerCase()] || 'roleTypeLead')} {t('role')}</span>
                </div>
            </div>

            {/* Step Indicator */}
            <div className="step-indicator">
                {[1, 2, 3, 4, 5].map((s, i) => (
                    <div key={s} className={`step-dot ${step === s ? 'active' : ''} ${step > s ? 'completed' : ''}`}>
                        <div className="dot">{step > s ? '✓' : s}</div>
                        {i < 4 && <div className="line" />}
                    </div>
                ))}
            </div>

            <div style={{ marginBottom: 'var(--space-sm)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                {t('step')} {step} {t('of')} {totalSteps}: {[t('stepPersonal'), t('stepAbout'), t('stepPhotos'), t('stepVoice'), t('stepReview')][step - 1]}
            </div>

            {uploadProgress && (
                <div style={{
                    marginBottom: 'var(--space-lg)',
                    padding: 'var(--space-md) var(--space-lg)',
                    background: 'rgba(212,168,83,0.08)',
                    border: '1px solid rgba(212,168,83,0.25)',
                    borderRadius: 'var(--radius-md)',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.82rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
                        <span>⬆️ Uploading files to secure storage…</span>
                        <span>{uploadProgress.current} / {uploadProgress.total}</span>
                    </div>
                    <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%`,
                            background: 'linear-gradient(90deg, var(--accent-gold), #e8c36a)',
                            borderRadius: '4px',
                            transition: 'width 0.3s ease',
                        }} />
                    </div>
                </div>
            )}

            {error && (
                <div className="toast error" style={{ position: 'relative', bottom: 'auto', right: 'auto', marginBottom: 'var(--space-lg)' }}>
                    ⚠️ {error}
                </div>
            )}

            {/* ═══ STEP 1: Personal Info ═══ */}
            {step === 1 && (
                <div className="animate-fade-in-up">
                    <h3 style={{ marginBottom: 'var(--space-xs)' }}>{t('basicsTitle')}</h3>
                    <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-xl)' }}>
                        {t('basicsDesc')}
                    </p>

                    <div className="grid-2" style={{ gap: 'var(--space-md)' }}>
                        <div className="form-group">
                            <label className="form-label">{t('fullName')}</label>
                            <input className="form-input" type="text" placeholder={t('fullNamePlaceholder')} value={formData.fullName} onChange={(e) => updateField('fullName', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('email')}</label>
                            <input className="form-input" type="text" inputMode="email" autoComplete="email" placeholder={t('emailPlaceholder')} value={formData.email} onChange={(e) => updateField('email', e.target.value)} />
                        </div>
                    </div>

                    <div className="grid-2" style={{ gap: 'var(--space-md)' }}>
                        <div className="form-group">
                            <label className="form-label">{t('phone')}</label>
                            <input className="form-input" type="tel" placeholder={t('phonePlaceholder')} value={formData.phone} onChange={(e) => updateField('phone', e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('age')}</label>
                            <input className="form-input" type="number" placeholder="25" min="5" max="100" value={formData.age} onChange={(e) => updateField('age', e.target.value)} />
                        </div>
                    </div>

                    <div className="grid-2" style={{ gap: 'var(--space-md)' }}>
                        <div className="form-group">
                            <label className="form-label">{t('gender')}</label>
                            <select className="form-select" value={formData.gender} onChange={(e) => updateField('gender', e.target.value)}>
                                <option value="">{t('select')}</option>
                                <option value="Male">{t('male')}</option>
                                <option value="Female">{t('female')}</option>
                                <option value="Non-binary">{t('nonBinary')}</option>
                                <option value="Prefer not to say">{t('preferNot')}</option>
                                <option value="Other">{t('other')}</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('location')}</label>
                            <input className="form-input" type="text" placeholder={t('locationPlaceholder')} value={formData.location} onChange={(e) => updateField('location', e.target.value)} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">{t('aboutYourself')}</label>
                        <textarea className="form-textarea" placeholder={t('aboutPlaceholder')} value={formData.experience} onChange={(e) => updateField('experience', e.target.value)} />
                    </div>

                    <div className="form-group">
                        <label className="form-label">{t('specialSkills')}</label>
                        <input className="form-input" type="text" placeholder={t('skillsPlaceholder')} value={formData.specialSkills} onChange={(e) => updateField('specialSkills', e.target.value)} />
                    </div>
                </div>
            )}

            {/* ═══ STEP 2: Personality / About You ═══ */}
            {step === 2 && (
                <div className="animate-fade-in-up">
                    <h3 style={{ marginBottom: 'var(--space-xs)' }}>{t('personalityTitle')}</h3>
                    <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-xl)' }}>
                        {t('personalityDesc')}
                    </p>

                    <div className="form-group">
                        <label className="form-label">{t('describeYourself')} *</label>
                        <input className="form-input" type="text" placeholder={t('describePlaceholder')} value={formData.describe_yourself} onChange={(e) => updateField('describe_yourself', e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('whyActing')} *</label>
                        <textarea className="form-textarea" placeholder={t('whyPlaceholder')} style={{ minHeight: '100px' }} value={formData.why_acting} onChange={(e) => updateField('why_acting', e.target.value)} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('dreamRole')} *</label>
                        <textarea className="form-textarea" placeholder={t('dreamPlaceholder')} style={{ minHeight: '100px' }} value={formData.dream_role} onChange={(e) => updateField('dream_role', e.target.value)} />
                    </div>
                </div>
            )}

            {/* ═══ STEP 3: Photo Gallery ═══ */}
            {step === 3 && (
                <div className="animate-fade-in-up">
                    <h3 style={{ marginBottom: 'var(--space-xs)' }}>{t('photosTitle')}</h3>
                    <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-sm)' }}>
                        {t('photosDesc')}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-xl)' }}>
                        📷 {t('photosTip')}
                    </p>

                    <div className="photo-upload-grid" style={{ gap: 'var(--space-md)' }}>
                        {PHOTO_SLOT_KEYS.map((slot) => {
                            const file = photos[slot.key]
                            const sizeMB = file ? file.size / (1024 * 1024) : 0

                            return (
                                <div key={slot.key} style={{ marginBottom: 'var(--space-sm)' }}>
                                    <div
                                        className={`file-upload-zone ${file ? 'has-file' : ''}`}
                                        onClick={() => fileInputRefs.current[slot.key]?.click()}
                                        style={{ padding: 'var(--space-lg)', minHeight: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                                    >
                                        {file ? (
                                            <>
                                                {/* Delete button */}
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setPhotos((prev) => ({ ...prev, [slot.key]: null }))
                                                        // Reset the file input so the same file can be re-selected
                                                        if (fileInputRefs.current[slot.key]) {
                                                            fileInputRefs.current[slot.key]!.value = ''
                                                        }
                                                    }}
                                                    aria-label={t('removePhoto')}
                                                    style={{
                                                        position: 'absolute', top: '8px', right: '8px', zIndex: 2,
                                                        width: '28px', height: '28px', borderRadius: '50%',
                                                        background: 'rgba(239,68,68,0.85)', color: '#fff',
                                                        border: 'none', cursor: 'pointer',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.85rem', fontWeight: 700,
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                                        transition: 'transform 0.15s ease, background 0.15s ease',
                                                    }}
                                                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.background = 'rgba(239,68,68,1)' }}
                                                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'rgba(239,68,68,0.85)' }}
                                                >
                                                    ✕
                                                </button>

                                                {/* Preview image */}
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={URL.createObjectURL(file)}
                                                    alt={t(slot.labelKey as Parameters<typeof t>[0])}
                                                    style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-xs)' }}
                                                />

                                                {/* File info */}
                                                <div style={{ width: '100%', marginTop: '4px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                                                            ✓ {file.name}
                                                        </span>
                                                        <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                                                            {sizeMB.toFixed(1)} MB
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '3px', textAlign: 'center' }}>
                                                        {t('tapToReplace')}
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)', color: slot.required ? 'var(--accent-gold)' : 'var(--text-tertiary)' }}>
                                                    📸
                                                </div>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '2px' }}>
                                                    {t(slot.labelKey as Parameters<typeof t>[0])} {slot.required && <span style={{ color: 'var(--accent-gold)' }}>*</span>}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{t(slot.descKey as Parameters<typeof t>[0])}</div>
                                            </>
                                        )}
                                    </div>
                                    <input
                                        ref={(el) => { fileInputRefs.current[slot.key] = el }}
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={(e) => handlePhotoChange(slot.key, e)}
                                    />
                                </div>
                            )
                        })}
                    </div>

                    <div style={{ textAlign: 'center', marginTop: 'var(--space-md)', fontSize: '0.85rem', color: requiredPhotosCount >= 4 ? 'var(--success)' : 'var(--text-tertiary)' }}>
                        {requiredPhotosCount}/4 {t('photosUploaded')}
                        {requiredPhotosCount >= 4 && ' ✓'}
                    </div>
                </div>
            )}

            {/* ═══ STEP 4: Voice Recording & Social Media ═══ */}
            {step === 4 && (
                <div className="animate-fade-in-up">
                    <h3 style={{ marginBottom: 'var(--space-xs)' }}>{t('voiceTitle')}</h3>
                    <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-xl)' }}>
                        {t('voiceDesc')}
                    </p>

                    <VoiceRecorder audioFile={audioFile} onAudioChange={setAudioFile} />

                    {/* Social Media */}
                    <div style={{
                        padding: 'var(--space-xl)',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-subtle)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                            <span style={{ fontSize: '1.5rem' }}>🌐</span>
                            <div>
                                <div style={{ fontWeight: 600 }}>{t('socialMedia')}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{t('socialDesc')}</div>
                            </div>
                        </div>

                        {/* Primary Social */}
                        <div className="social-grid" style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                            <select className="form-select" value={formData.socialPlatform} onChange={(e) => updateField('socialPlatform', e.target.value)}>
                                {SOCIAL_PLATFORMS.map((p) => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                            <input className="form-input" type="text" placeholder={t('usernamePlaceholder')} value={formData.socialUsername} onChange={(e) => updateField('socialUsername', e.target.value)} />
                        </div>

                        {/* Optional Second Social */}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }}>
                            {t('additionalSocial')}
                        </div>
                        <div className="social-grid" style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 'var(--space-sm)' }}>
                            <select className="form-select" value={formData.socialPlatform2} onChange={(e) => updateField('socialPlatform2', e.target.value)}>
                                <option value="">{t('selectPlatform')}</option>
                                {SOCIAL_PLATFORMS.map((p) => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                            <input className="form-input" type="text" placeholder={t('usernamePlaceholder')} value={formData.socialUsername2} onChange={(e) => updateField('socialUsername2', e.target.value)} />
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ STEP 5: Review & Consent ═══ */}
            {step === 5 && (
                <div className="animate-fade-in-up">
                    <h3 style={{ marginBottom: 'var(--space-xs)' }}>{t('reviewTitle')}</h3>
                    <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-xl)' }}>
                        {t('reviewDesc')}
                    </p>

                    {/* Summary Card */}
                    <div className="glass-card" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
                        <h4 style={{ marginBottom: 'var(--space-md)' }}>{t('summary')}</h4>
                        <div className="form-grid-2col" style={{ fontSize: '0.85rem' }}>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>{t('name')}</span>{' '}
                                <span style={{ color: 'var(--text-primary)' }}>{formData.fullName}</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>{t('emailLabel')}</span>{' '}
                                <span style={{ color: 'var(--text-primary)' }}>{formData.email}</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>{t('ageLabel')}</span>{' '}
                                <span style={{ color: 'var(--text-primary)' }}>{formData.age}</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>{t('genderLabel')}</span>{' '}
                                <span style={{ color: 'var(--text-primary)' }}>{formData.gender}</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>{t('photos')}</span>{' '}
                                <span style={{ color: 'var(--success)' }}>{Object.values(photos).filter(Boolean).length} {t('uploaded')}</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>{t('voice')}</span>{' '}
                                <span style={{ color: audioFile ? 'var(--success)' : 'var(--error)' }}>{audioFile ? '✓ ' + t('voiceUploaded') : '✗ ' + t('voiceMissing')}</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>{t('social')}</span>{' '}
                                <span style={{ color: 'var(--text-primary)' }}>
                                    {SOCIAL_PLATFORMS.find((p) => p.value === formData.socialPlatform)?.label}: {formData.socialUsername}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Consent Checkboxes */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                        {[
                            { key: 'consent_media', text: t('consent1') },
                            { key: 'consent_voluntary', text: t('consent2') },
                            { key: 'consent_privacy', text: t('consent3') },
                        ].map((item) => (
                            <label
                                key={item.key}
                                style={{
                                    display: 'flex',
                                    gap: 'var(--space-md)',
                                    padding: 'var(--space-lg)',
                                    background: consents[item.key as keyof typeof consents] ? 'rgba(52, 211, 153, 0.05)' : 'var(--bg-secondary)',
                                    border: `1px solid ${consents[item.key as keyof typeof consents] ? 'rgba(52, 211, 153, 0.3)' : 'var(--border-subtle)'}`,
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer',
                                    transition: 'all var(--transition-fast)',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={consents[item.key as keyof typeof consents]}
                                    onChange={(e) => setConsents((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        accentColor: 'var(--accent-gold)',
                                        flexShrink: 0,
                                        marginTop: '2px',
                                    }}
                                />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                    {item.text}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ Navigation Buttons ═══ */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 'var(--space-2xl)',
                paddingTop: 'var(--space-lg)',
                borderTop: '1px solid var(--border-subtle)',
            }}>
                {step > 1 ? (
                    <button className="btn btn-secondary" onClick={() => goToStep(step - 1)}>
                        ← {t('back').replace('← ', '')}
                    </button>
                ) : (
                    <div />
                )}

                {step < totalSteps ? (
                    <button
                        className="btn btn-primary"
                        onClick={() => goToStep(step + 1)}
                        disabled={!canProceed(step)}
                        style={{ opacity: canProceed(step) ? 1 : 0.5 }}
                    >
                        {t('continue')}
                    </button>
                ) : (
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={handleSubmit}
                        disabled={!canProceed(5) || submitting}
                        style={{ opacity: canProceed(5) && !submitting ? 1 : 0.5 }}
                    >
                        {uploadProgress ? (
                            <>
                                <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                                Uploading {uploadProgress.current}/{uploadProgress.total}…
                            </>
                        ) : submitting ? (
                            <>
                                <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                                {t('submitting')}
                            </>
                        ) : (
                            <>{t('submit')}</>
                        )}
                    </button>
                )}
            </div>
        </div>
    )
}
