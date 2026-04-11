'use client'

import { useState, useRef, useEffect } from 'react'
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

type MediaProfile = {
    front_headshot?: string | null
    side_profile?: string | null
    full_body?: string | null
    expression?: string | null
    optional_1?: string | null
    optional_2?: string | null
    voiceRecording?: string | null
}

const PHOTO_SLOT_KEYS = [
    { key: 'front_headshot', labelKey: 'photoFrontHeadshot', descKey: 'photoFrontDesc', required: true },
    { key: 'side_profile',   labelKey: 'photoSideProfile',   descKey: 'photoSideDesc',  required: true },
    { key: 'full_body',      labelKey: 'photoFullBody',       descKey: 'photoFullDesc',  required: true },
    { key: 'expression',     labelKey: 'photoExpression',     descKey: 'photoExpressionDesc', required: true },
    { key: 'optional_1',     labelKey: 'photoOptional1',      descKey: 'photoOptional1Desc',  required: false },
    { key: 'optional_2',     labelKey: 'photoOptional2',      descKey: 'photoOptional2Desc',  required: false },
]

const SOCIAL_PLATFORMS = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'tiktok',    label: 'TikTok' },
    { value: 'youtube',   label: 'YouTube' },
    { value: 'x',         label: 'X (Twitter)' },
    { value: 'facebook',  label: 'Facebook' },
    { value: 'linkedin',  label: 'LinkedIn' },
    { value: 'imdb',      label: 'IMDb' },
    { value: 'backstage', label: 'Backstage' },
    { value: 'other',     label: 'Other' },
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

    // ── Saved media profile ──────────────────────────────────────────────────
    const [savedMedia, setSavedMedia] = useState<MediaProfile | null>(null)
    const [useSavedPhotos, setUseSavedPhotos] = useState(false)
    const [useSavedAudio, setUseSavedAudio] = useState(false)

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
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)

    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

    const totalSteps = 5

    // ── Fetch saved media profile on mount ───────────────────────────────────
    useEffect(() => {
        fetch('/api/user/media-profile')
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.mediaProfile) {
                    const mp: MediaProfile = data.mediaProfile
                    // Only surface saved media if at least 4 required photos exist
                    const requiredKeys = ['front_headshot', 'side_profile', 'full_body', 'expression']
                    const hasRequired = requiredKeys.every(k => mp[k as keyof MediaProfile])
                    if (hasRequired) {
                        setSavedMedia(mp)
                        // Default to using saved media
                        setUseSavedPhotos(true)
                        if (mp.voiceRecording) setUseSavedAudio(true)
                    }
                }
            })
            .catch(() => { /* not logged in or no profile — ignore */ })
    }, [])

    const updateField = (key: string, value: string) => {
        setFormData((prev) => ({ ...prev, [key]: value }))
    }

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
        if (file.size > 10 * 1024 * 1024) { setError(t('imageTooLarge')); return }
        const mime = inferMime(file)
        if (!mime.startsWith('image/')) { setError(t('invalidImage')); return }
        setError('')
        setPhotos((prev) => ({ ...prev, [key]: file }))
        // Switching to new upload for this role — disable saved photos mode
        setUseSavedPhotos(false)
    }

    // Count of required new-upload photos
    const newRequiredCount = Object.entries(photos).filter(([key, file]) => {
        const slot = PHOTO_SLOT_KEYS.find((s) => s.key === key)
        return slot?.required && file !== null
    }).length

    // Photos are satisfied if using saved OR enough new ones uploaded
    const photosReady = (useSavedPhotos && savedMedia !== null) || newRequiredCount >= 4
    // Audio is satisfied if using saved OR a new file provided
    const audioReady  = (useSavedAudio && !!savedMedia?.voiceRecording) || !!audioFile

    const canProceed = (s: number) => {
        if (isAdmin) return true
        switch (s) {
            case 1: return formData.fullName && formData.email && formData.age && formData.gender
            case 2: return formData.describe_yourself && formData.why_acting && formData.dream_role
            case 3: return photosReady
            case 4: return audioReady && formData.socialUsername
            case 5: return consents.consent_media && consents.consent_voluntary && consents.consent_privacy
            default: return false
        }
    }

    const goToStep = (nextStep: number) => {
        setError('')
        setStep(nextStep)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    /**
     * Upload a single file directly to R2 via presigned PUT.
     * Passes castingCallId so files land in the correct per-call folder.
     */
    const uploadFileDirect = async (file: File, kind: 'image' | 'audio', name: string): Promise<string> => {
        const mime     = inferMime(file)
        const castingCallId = castingCall.id

        try {
            const signRes = await fetch('/api/upload/presign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName: file.name, fileType: mime, kind, name, castingCallId }),
            })
            if (signRes.ok) {
                const { presignedUrl, finalUrl } = await signRes.json()
                const putRes = await fetch(presignedUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': mime },
                    credentials: 'omit',
                    body: file,
                })
                if (putRes.ok) return finalUrl
                console.warn('[Upload] Direct R2 PUT failed, falling back to stream proxy')
            }
        } catch (e) {
            console.warn('[Upload] Presign/R2 failed, falling back to stream proxy:', e)
        }

        // Fallback: stream proxy
        const nameSlug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').slice(0, 40) || 'applicant'
        const category = kind === 'image' ? 'photos' : 'audio'
        const folder   = `casting/calls/${castingCallId}/${nameSlug}`
        const streamRes = await fetch(
            `/api/upload/stream?fileName=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(mime)}&folder=${encodeURIComponent(folder + '/' + category)}&fileSize=${file.size}`,
            { method: 'POST', body: file },
        )
        if (!streamRes.ok) {
            const err = await streamRes.json().catch(() => ({}))
            throw new Error(err.error || `Upload failed: ${file.name}`)
        }
        const { finalUrl } = await streamRes.json()
        return finalUrl
    }

    /**
     * Server-side R2 copy: reuse a saved file into this casting call's folder.
     * Zero bytes from the browser.
     */
    const copysavedFile = async (sourceUrl: string, slot: string): Promise<string> => {
        const res = await fetch('/api/upload/copy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sourceUrl,
                castingCallId: castingCall.id,
                slot,
                name: formData.fullName,
            }),
        })
        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error || `Copy failed for slot: ${slot}`)
        }
        const { finalUrl } = await res.json()
        return finalUrl
    }

    const handleSubmit = async () => {
        if (!canProceed(5)) return
        setSubmitting(true)
        setError('')
        setUploadProgress(null)

        try {
            // ── Count total file operations ──────────────────────────────────
            const photoEntries    = Object.entries(photos).filter(([, f]) => f !== null) as [string, File][]
            const savedPhotoSlots = useSavedPhotos && savedMedia
                ? PHOTO_SLOT_KEYS.map(s => s.key).filter(k => savedMedia[k as keyof MediaProfile])
                : []
            const needsNewAudio   = !useSavedAudio || !savedMedia?.voiceRecording

            const totalOps = photoEntries.length + savedPhotoSlots.length + (needsNewAudio && audioFile ? 1 : 0) + (!needsNewAudio ? 1 : 0)
            let completed  = 0
            setUploadProgress({ current: 0, total: totalOps })

            // ── Upload new photos (fresh files) ──────────────────────────────
            const photoUrls: Record<string, string> = {}
            for (const [key, file] of photoEntries) {
                photoUrls[key] = await uploadFileDirect(file, 'image', formData.fullName)
                completed++
                setUploadProgress({ current: completed, total: totalOps })
            }

            // ── Copy saved photos into this casting call's folder ─────────────
            for (const slot of savedPhotoSlots) {
                const savedUrl = savedMedia![slot as keyof MediaProfile] as string
                photoUrls[slot] = await copysavedFile(savedUrl, slot)
                completed++
                setUploadProgress({ current: completed, total: totalOps })
            }

            // ── Handle audio ─────────────────────────────────────────────────
            let voiceUrl: string | null = null
            if (!needsNewAudio && savedMedia?.voiceRecording) {
                voiceUrl = await copysavedFile(savedMedia.voiceRecording, 'voiceRecording')
                completed++
                setUploadProgress({ current: completed, total: totalOps })
            } else if (audioFile) {
                voiceUrl = await uploadFileDirect(audioFile, 'audio', formData.fullName)
                completed++
                setUploadProgress({ current: completed, total: totalOps })
            }

            setUploadProgress(null)

            // ── Submit metadata + R2 URLs ────────────────────────────────────
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

            // ── Update media profile with the URLs used for this application ─
            const profileUpdate: MediaProfile = { ...photoUrls, voiceRecording: voiceUrl }
            fetch('/api/user/media-profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileUpdate),
            }).catch(() => { /* non-critical */ })

            setSubmitted(true)
        } catch (err: unknown) {
            setUploadProgress(null)
            const rawMsg = err instanceof Error ? err.message : String(err)
            console.error('[ApplicationForm] Submit failed:', rawMsg)
            setError(isAdmin ? rawMsg : t('friendlyUploadError'))
        } finally {
            setSubmitting(false)
        }
    }

    if (submitted) {
        return <ApplicationSuccess roleName={castingCall.roleName} projectTitle={castingCall.project.title} />
    }

    // ── Saved media banner (shown at top of Step 3 and 4) ───────────────────
    const SavedMediaBanner = ({ mode }: { mode: 'photos' | 'audio' }) => {
        const isSaved = mode === 'photos' ? useSavedPhotos : useSavedAudio
        const setSaved = mode === 'photos'
            ? (v: boolean) => setUseSavedPhotos(v)
            : (v: boolean) => setUseSavedAudio(v)
        const btnSaved  = mode === 'photos' ? t('useSavedPhotos')  : t('useSavedAudio')
        const btnNew    = mode === 'photos' ? t('uploadNewPhotos') : t('uploadNewAudio')
        const warning   = mode === 'photos' ? t('savedPhotosWarning') : t('savedAudioWarning')

        return (
            <div style={{
                marginBottom: 'var(--space-xl)',
                padding: 'var(--space-md) var(--space-lg)',
                background: 'rgba(212,168,83,0.07)',
                border: '1px solid rgba(212,168,83,0.25)',
                borderRadius: 'var(--radius-md)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-sm)' }}>
                    <span style={{ fontSize: '1.1rem' }}>✨</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-gold)' }}>
                        {t('savedMediaFound')}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => setSaved(true)}
                        style={{
                            padding: '6px 16px', fontSize: '0.8rem', fontWeight: 600, borderRadius: 'var(--radius-full)',
                            border: `1px solid ${isSaved ? 'rgba(52,211,153,0.5)' : 'var(--border-subtle)'}`,
                            background: isSaved ? 'rgba(52,211,153,0.12)' : 'transparent',
                            color: isSaved ? 'var(--color-success)' : 'var(--text-secondary)',
                            cursor: 'pointer', transition: 'all 0.2s',
                        }}
                    >
                        ✓ {btnSaved}
                    </button>
                    <button
                        type="button"
                        onClick={() => setSaved(false)}
                        style={{
                            padding: '6px 16px', fontSize: '0.8rem', fontWeight: 600, borderRadius: 'var(--radius-full)',
                            border: `1px solid ${!isSaved ? 'rgba(212,168,83,0.5)' : 'var(--border-subtle)'}`,
                            background: !isSaved ? 'rgba(212,168,83,0.08)' : 'transparent',
                            color: !isSaved ? 'var(--accent-gold)' : 'var(--text-secondary)',
                            cursor: 'pointer', transition: 'all 0.2s',
                        }}
                    >
                        ↑ {btnNew}
                    </button>
                </div>
                {isSaved && (
                    <p style={{ marginTop: 'var(--space-sm)', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        ℹ️ {warning}
                    </p>
                )}
            </div>
        )
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
                        <span>⬆️ {t('copyingFiles')}</span>
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
                    <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-xl)' }}>{t('basicsDesc')}</p>

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

            {/* ═══ STEP 2: Personality ═══ */}
            {step === 2 && (
                <div className="animate-fade-in-up">
                    <h3 style={{ marginBottom: 'var(--space-xs)' }}>{t('personalityTitle')}</h3>
                    <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-xl)' }}>{t('personalityDesc')}</p>

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
                    <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-sm)' }}>{t('photosDesc')}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-xl)' }}>
                        📷 {t('photosTip')}
                    </p>

                    {/* Saved media banner */}
                    {savedMedia && <SavedMediaBanner mode="photos" />}

                    {/* Saved photo thumbnails */}
                    {useSavedPhotos && savedMedia && (
                        <div className="photo-upload-grid" style={{ gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                            {PHOTO_SLOT_KEYS.map(slot => {
                                const url = savedMedia[slot.key as keyof MediaProfile] as string | undefined
                                if (!url) return null
                                return (
                                    <div key={slot.key} style={{ position: 'relative' }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={url}
                                            alt={t(slot.labelKey as Parameters<typeof t>[0])}
                                            style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid rgba(52,211,153,0.3)' }}
                                        />
                                        <span style={{
                                            position: 'absolute', top: '6px', left: '6px',
                                            fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px',
                                            background: 'rgba(52,211,153,0.85)', color: '#fff',
                                            borderRadius: 'var(--radius-full)',
                                        }}>
                                            ✓ {t('savedBadge')}
                                        </span>
                                        <div style={{ fontSize: '0.72rem', marginTop: '4px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                                            {t(slot.labelKey as Parameters<typeof t>[0])}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* New upload grid — only shown when not using saved */}
                    {!useSavedPhotos && (
                        <>
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
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setPhotos((prev) => ({ ...prev, [slot.key]: null }))
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
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={URL.createObjectURL(file)}
                                                            alt={t(slot.labelKey as Parameters<typeof t>[0])}
                                                            style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-xs)' }}
                                                        />
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
                                                        <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)', color: slot.required ? 'var(--accent-gold)' : 'var(--text-tertiary)' }}>📸</div>
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

                            <div style={{ textAlign: 'center', marginTop: 'var(--space-md)', fontSize: '0.85rem', color: newRequiredCount >= 4 ? 'var(--success)' : 'var(--text-tertiary)' }}>
                                {newRequiredCount}/4 {t('photosUploaded')}
                                {newRequiredCount >= 4 && ' ✓'}
                            </div>
                        </>
                    )}

                    {useSavedPhotos && savedMedia && (
                        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--color-success)', marginTop: 'var(--space-md)' }}>
                            ✓ {t('savedPhotosReady')}
                        </p>
                    )}
                </div>
            )}

            {/* ═══ STEP 4: Voice Recording & Social Media ═══ */}
            {step === 4 && (
                <div className="animate-fade-in-up">
                    <h3 style={{ marginBottom: 'var(--space-xs)' }}>{t('voiceTitle')}</h3>
                    <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-xl)' }}>{t('voiceDesc')}</p>

                    {/* Saved audio banner */}
                    {savedMedia?.voiceRecording && <SavedMediaBanner mode="audio" />}

                    {/* Show recorder only when not using saved audio */}
                    {!useSavedAudio && <VoiceRecorder audioFile={audioFile} onAudioChange={setAudioFile} />}

                    {useSavedAudio && savedMedia?.voiceRecording && (
                        <div style={{
                            padding: 'var(--space-md)', marginBottom: 'var(--space-xl)',
                            background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.2)',
                            borderRadius: 'var(--radius-md)', textAlign: 'center',
                            fontSize: '0.85rem', color: 'var(--color-success)',
                        }}>
                            🎙️ {t('savedAudioReady')}
                        </div>
                    )}

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

                        <div className="social-grid" style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                            <select className="form-select" value={formData.socialPlatform} onChange={(e) => updateField('socialPlatform', e.target.value)}>
                                {SOCIAL_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                            </select>
                            <input className="form-input" type="text" placeholder={t('usernamePlaceholder')} value={formData.socialUsername} onChange={(e) => updateField('socialUsername', e.target.value)} />
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }}>{t('additionalSocial')}</div>
                        <div className="social-grid" style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 'var(--space-sm)' }}>
                            <select className="form-select" value={formData.socialPlatform2} onChange={(e) => updateField('socialPlatform2', e.target.value)}>
                                <option value="">{t('selectPlatform')}</option>
                                {SOCIAL_PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
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
                    <p style={{ fontSize: '0.9rem', marginBottom: 'var(--space-xl)' }}>{t('reviewDesc')}</p>

                    <div className="glass-card" style={{ padding: 'var(--space-xl)', marginBottom: 'var(--space-xl)' }}>
                        <h4 style={{ marginBottom: 'var(--space-md)' }}>{t('summary')}</h4>
                        <div className="form-grid-2col" style={{ fontSize: '0.85rem' }}>
                            <div><span style={{ color: 'var(--text-tertiary)' }}>{t('name')}</span>{' '}<span style={{ color: 'var(--text-primary)' }}>{formData.fullName}</span></div>
                            <div><span style={{ color: 'var(--text-tertiary)' }}>{t('emailLabel')}</span>{' '}<span style={{ color: 'var(--text-primary)' }}>{formData.email}</span></div>
                            <div><span style={{ color: 'var(--text-tertiary)' }}>{t('ageLabel')}</span>{' '}<span style={{ color: 'var(--text-primary)' }}>{formData.age}</span></div>
                            <div><span style={{ color: 'var(--text-tertiary)' }}>{t('genderLabel')}</span>{' '}<span style={{ color: 'var(--text-primary)' }}>{formData.gender}</span></div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>{t('photos')}</span>{' '}
                                <span style={{ color: 'var(--success)' }}>
                                    {useSavedPhotos && savedMedia
                                        ? `✓ ${t('savedBadge')}`
                                        : `${Object.values(photos).filter(Boolean).length} ${t('uploaded')}`}
                                </span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>{t('voice')}</span>{' '}
                                <span style={{ color: audioReady ? 'var(--success)' : 'var(--error)' }}>
                                    {audioReady
                                        ? (useSavedAudio ? `✓ ${t('savedBadge')}` : `✓ ${t('voiceUploaded')}`)
                                        : `✗ ${t('voiceMissing')}`}
                                </span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-tertiary)' }}>{t('social')}</span>{' '}
                                <span style={{ color: 'var(--text-primary)' }}>
                                    {SOCIAL_PLATFORMS.find((p) => p.value === formData.socialPlatform)?.label}: {formData.socialUsername}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                        {[
                            { key: 'consent_media',      text: t('consent1') },
                            { key: 'consent_voluntary',  text: t('consent2') },
                            { key: 'consent_privacy',    text: t('consent3') },
                        ].map((item) => (
                            <label
                                key={item.key}
                                style={{
                                    display: 'flex', gap: 'var(--space-md)',
                                    padding: 'var(--space-lg)',
                                    background: consents[item.key as keyof typeof consents] ? 'rgba(52, 211, 153, 0.05)' : 'var(--bg-secondary)',
                                    border: `1px solid ${consents[item.key as keyof typeof consents] ? 'rgba(52, 211, 153, 0.3)' : 'var(--border-subtle)'}`,
                                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                    transition: 'all var(--transition-fast)',
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={consents[item.key as keyof typeof consents]}
                                    onChange={(e) => setConsents((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                                    style={{ width: '20px', height: '20px', accentColor: 'var(--accent-gold)', flexShrink: 0, marginTop: '2px' }}
                                />
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{item.text}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ Navigation Buttons ═══ */}
            <div style={{
                display: 'flex', justifyContent: 'space-between',
                marginTop: 'var(--space-2xl)', paddingTop: 'var(--space-lg)',
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
                                {uploadProgress.current}/{uploadProgress.total}…
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
