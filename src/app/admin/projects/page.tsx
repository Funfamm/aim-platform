'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import AdminSidebar from '@/components/AdminSidebar'
import FileUploader from '@/components/FileUploader'
import { transcribeVideo } from '@/lib/transcribe-client'
import { runQC, formatQCSummary, type QCResult } from '@/lib/subtitle-qc'
import { LANGUAGE_NAMES, TOTAL_SUBTITLE_LANGS, isBlockedStreamingUrl, requiresTranslationGate } from '@/config/subtitles'
import LangStatusGrid from '@/components/admin/LangStatusGrid'
import PublishGateModal from '@/components/admin/PublishGateModal'
import SubtitleEditor, { type SubtitleCue } from '@/components/admin/SubtitleEditor'
import { uploadSubtitleFile } from '@/lib/subtitle-file-parser'
import { readSSEStream } from '@/lib/sse-reader'

/* ── Types ── */
type Project = {
    id: string; title: string; slug: string; tagline: string; description: string
    status: string; genre: string | null; year: string | null; duration: string | null
    featured: boolean; published: boolean; publishAt: string | null; sortOrder: number; coverImage: string | null
    trailerUrl: string | null; filmUrl: string | null; projectType: string
    gallery: string | null; credits: string | null; sponsorData: string | null
    viewCount: number
    _count: { castingCalls: number }
}

type FormData = {
    title: string; slug: string; tagline: string; description: string
    status: string; genre: string; year: string; duration: string
    featured: boolean; published: boolean; publishAt: string; coverImage: string
    trailerUrl: string; filmUrl: string; projectType: string
    gallery: string; credits: string; sponsorData: string
}

const EMPTY_FORM: FormData = {
    title: '', slug: '', tagline: '', description: '',
    status: 'upcoming', genre: '', year: '', duration: '',
    featured: false, published: false, publishAt: '', coverImage: '',
    trailerUrl: '', filmUrl: '', projectType: 'movie',
    gallery: '', credits: '', sponsorData: '',
}

const STATUSES = ['upcoming', 'in-production', 'completed']


const statusConfig: Record<string, { label: string; className: string }> = {
    completed: { label: 'Completed', className: 'badge-green' },
    'in-production': { label: 'In Production', className: 'badge-gold' },
    upcoming: { label: 'Upcoming', className: 'badge-blue' },
}

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}



type FilmCastMember = {
    id: string
    name: string
    jobTitle: string
    character: string | null
    bio: string | null
    photoUrl: string | null
    instagramUrl: string | null
    bioTranslations: string | null
    sortOrder: number
}

type CastForm = {
    name: string
    jobTitle: string
    character: string
    bio: string
    photoUrl: string
    instagramUrl: string
}

const EMPTY_CAST_FORM: CastForm = { name: '', jobTitle: 'Actor', character: '', bio: '', photoUrl: '', instagramUrl: '' }

type ReviewSegment = { start: number; end: number; text: string }
type ReviewSubtitle = {
    segments: ReviewSegment[]
    translations: Record<string, ReviewSegment[]>
    qcIssues: QCResult[]
    translateStatus: string
    transcribedWith: string | null
    generatedWith: string | null
    langStatus: Record<string, string> | null  // per-language status from new schema field
}

export default function AdminProjectsPage() {
    const router = useRouter()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [sortBy, setSortBy] = useState<'default' | 'views'>('default')
    const [showModal, setShowModal] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<FormData>(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [deleting, setDeleting] = useState<string | null>(null)
    const [subtitleStatus, setSubtitleStatus] = useState<Record<string, string>>({})
    const [subtitleProgress, setSubtitleProgress] = useState<Record<string, number>>({})
    const [subtitlePhase, setSubtitlePhase] = useState<Record<string, 'transcribing' | 'translating' | 'done' | 'error' | null>>({})
    const [translationCount, setTranslationCount] = useState<Record<string, number>>({})
    const [translateStatus, setTranslateStatus] = useState<Record<string, string>>({})
    // Server-side subtitle job state (faster-whisper worker)
    type ServerJobStatus = 'idle' | 'queued' | 'processing' | 'ready' | 'failed'
    const [serverJobId, setServerJobId] = useState<Record<string, string | null>>({})
    const [serverJobStatus, setServerJobStatus] = useState<Record<string, ServerJobStatus>>({})
    const [serverJobMsg, setServerJobMsg] = useState<Record<string, string>>({})
    // Review modal
    const [reviewProjectId, setReviewProjectId] = useState<string | null>(null)
    const [reviewProjectTitle, setReviewProjectTitle] = useState('')
    const [reviewData, setReviewData] = useState<ReviewSubtitle | null>(null)
    const [reviewLang, setReviewLang] = useState('en')
    const [reviewLoading, setReviewLoading] = useState(false)
    const [retryingLang, setRetryingLang] = useState<string | null>(null)  // lang currently being retried
    // Generational counter — guards openReview against async race conditions.
    // If admin clicks Review on project B before project A's fetch resolves,
    // A's response is silently discarded.
    const reviewRequestRef = useRef(0)
    // Cast modal
    const [castProjectId, setCastProjectId] = useState<string | null>(null)
    const [castProjectTitle, setCastProjectTitle] = useState('')
    const [castMembers, setCastMembers] = useState<FilmCastMember[]>([])
    const [castLoading, setCastLoading] = useState(false)
    const [castForm, setCastForm] = useState<CastForm>(EMPTY_CAST_FORM)
    const [castSaving, setCastSaving] = useState(false)
    const [castError, setCastError] = useState('')
    const [translatingId, setTranslatingId] = useState<string | null>(null)
    // Publish confirmation gate
    const [showPublishWarning, setShowPublishWarning] = useState(false)
    // Track whether the project was already published when edit started
    const [wasPublished, setWasPublished] = useState(false)
    const [resending, setResending] = useState(false)
    // Publish notification audience — which groups get the email when published
    // Default to ALL FALSE — admin must explicitly opt-in each group
    const [notifyGroups, setNotifyGroups] = useState<{ subscribers: boolean; members: boolean; cast: boolean }>({
        subscribers: false,
        members: false,
        cast: false,
    })

    // ── Subtitle Editor modal ──────────────────────────────────────────────────
    const [editorProjectId, setEditorProjectId]       = useState<string | null>(null)
    const [editorSegments, setEditorSegments]         = useState<SubtitleCue[]>([])
    const [editorFilmUrl, setEditorFilmUrl]           = useState<string | null>(null)
    const [editorStatus, setEditorStatus]             = useState('pending')
    const [editorInitialPlacement, setEditorInitialPlacement] = useState<any>(null)
    const [editorInitialMobilePlacement, setEditorInitialMobilePlacement] = useState<any>(null)
    const [editorInitialLandscapePlacement, setEditorInitialLandscapePlacement] = useState<any>(null)
    const [editorUseSeparateMobile, setEditorUseSeparateMobile] = useState(false)
    // Track per-project approval state (refreshed after editor closes)
    const [subtitleApproval, setSubtitleApproval]     = useState<Record<string, string>>({})

    // ── Movie Roll assignment (inside project modal) ──────────────────────
    type RollOption = { id: string; title: string; icon: string; displayOn: string; visible: boolean }
    const [allRolls, setAllRolls] = useState<RollOption[]>([])
    const [selectedRollIds, setSelectedRollIds] = useState<string[]>([])
    const [rollsLoading, setRollsLoading] = useState(false)
    const [rollError, setRollError] = useState(false)

    // TOTAL_SUBTITLE_LANGS comes from subtitle-languages.ts — canonical constant, not hard-coded

    useEffect(() => {
        fetch('/api/admin/projects')
            .then(r => { if (r.status === 401) { window.location.href = '/admin/login'; return [] } return r.json() })
            .then((data: Project[]) => {
                setProjects(data)
                // Check which projects already have subtitles
                data.forEach((p: Project) => {
                    if (p.filmUrl) {
                        fetch(`/api/subtitles/${p.id}?lang=en`)
                            .then(r => r.json())
                            .then(sub => {
                                const count = sub.available?.length ?? 0
                                setTranslationCount(s => ({ ...s, [p.id]: count }))
                                setTranslateStatus(s => ({ ...s, [p.id]: sub.translateStatus ?? 'pending' }))
                                if (count > 0) {
                                    setSubtitleStatus(s => ({ ...s, [p.id]: count >= TOTAL_SUBTITLE_LANGS ? '✓ All languages ready' : `✓ ${count} lang` }))
                                    setSubtitlePhase(s => ({ ...s, [p.id]: 'done' }))
                                }
                            })
                            .catch(() => {})
                    }
                })
            })
            .catch(() => setError('Failed to load projects'))
            .finally(() => setLoading(false))
    }, [])

    const openCreate = () => {
        setEditingId(null)
        setForm(EMPTY_FORM)
        setSelectedRollIds([])
        setShowModal(true)
        setError('')
        // Fetch available rolls
        setRollsLoading(true)
        fetch('/api/admin/movie-rolls')
            .then(r => r.ok ? r.json() : [])
            .then(setAllRolls)
            .catch(() => {})
            .finally(() => setRollsLoading(false))
    }

    const openEdit = (p: Project) => {
        setEditingId(p.id)
        setForm({
            title: p.title,
            slug: p.slug,
            tagline: p.tagline || '',
            description: p.description,
            status: p.status,
            genre: p.genre || '',
            year: p.year || '',
            duration: p.duration || '',
            featured: p.featured,
            published: p.published ?? false,
            publishAt: p.publishAt ? new Date(p.publishAt).toISOString().slice(0, 16) : '',
            coverImage: p.coverImage || '',
            trailerUrl: p.trailerUrl || '',
            filmUrl: p.filmUrl || '',
            projectType: p.projectType || 'movie',
            gallery: p.gallery || '',
            credits: p.credits || '',
            sponsorData: p.sponsorData || '',
        })
        setSelectedRollIds([])
        setShowModal(true)
        setWasPublished(p.published ?? false)
        // Reset audience checkboxes when opening a project
        setNotifyGroups({ subscribers: false, members: false, cast: false })
        setError('')
        // Fetch rolls + current assignments + subtitle approval status in parallel
        setRollsLoading(true)
        Promise.all([
            fetch('/api/admin/movie-rolls').then(r => r.ok ? r.json() : []),
            fetch(`/api/admin/projects/${p.id}/rolls`).then(r => r.ok ? r.json() : []),
            // Load the subtitle approval gate status so Translate button renders correctly
            fetch(`/api/admin/subtitles?projectId=${p.id}`)
                .then(r => r.ok ? r.json() : {})
                .then((res: { subtitle?: { status?: string } }) => {
                    if (res.subtitle?.status) {
                        setSubtitleApproval(prev => ({ ...prev, [p.id]: res.subtitle!.status! }))
                    }
                })
                .catch(() => {}),
        ]).then(([rolls, assignedIds]) => {
            setAllRolls(rolls)
            setSelectedRollIds(assignedIds)
        }).catch(() => {}).finally(() => setRollsLoading(false))
    }


    // Core save logic — called directly by handleSave (override=false)
    // or by handlePublishOverride (override=true) to bypass the translation gate.
    const doSave = async (override = false) => {
        if (!form.title || !form.description) {
            setError('Please fill in title and description')
            return
        }
        // Gate: translation confirmation required before publishing a project
        // with film, OR when saving a production-ready status with film (original gate).
        const needsGate = (form.published || requiresTranslationGate(form.status, form.filmUrl)) && !!form.filmUrl
        if (!override && needsGate && editingId) {
            const count = translationCount[editingId] ?? 0
            if (count < TOTAL_SUBTITLE_LANGS) {
                setShowPublishWarning(true)
                return
            }
        }
        // Gate: at least one roll must be selected
        if (allRolls.length > 0 && selectedRollIds.length === 0) {
            setError('🎬 This project must be assigned to at least one Movie Roll before saving.')
            setRollError(true)
            document.getElementById('roll-assignment-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return
        }
        setSaving(true)
        setError('')
        setRollError(false)
        try {
            const payload = {
                ...form,
                slug: form.slug || slugify(form.title),
                // Convert datetime-local string to ISO or null
                publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
                // Include audience selection when publishing immediately
                notifyGroups: form.published ? notifyGroups : undefined,
                // Persist audience selection for scheduled publish (cron will read this)
                publishNotifyGroups: form.publishAt && !form.published
                    ? JSON.stringify(notifyGroups)
                    : undefined,
            }
            const url = editingId ? `/api/admin/projects/${editingId}` : '/api/admin/projects'
            const method = editingId ? 'PUT' : 'POST'
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to save')
            }
            const saved = await res.json()
            // Save roll assignments (fire-and-forget — non-blocking)
            fetch(`/api/admin/projects/${saved.id}/rolls`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rollIds: selectedRollIds }),
            }).catch(() => {})
            if (editingId) {
                setProjects(prev => prev.map(p => p.id === editingId ? saved : p))
            } else {
                setProjects(prev => [...prev, saved])
            }
            // Re-check subtitle status if this project has a film URL (new or updated)
            if (saved.filmUrl) {
                fetch(`/api/subtitles/${saved.id}?lang=en`)
                    .then(r => r.json())
                    .then(sub => {
                        const count = sub.available?.length ?? 0
                        setTranslationCount(s => ({ ...s, [saved.id]: count }))
                        setTranslateStatus(s => ({ ...s, [saved.id]: sub.translateStatus ?? 'pending' }))
                        if (count > 0) {
                            setSubtitleStatus(s => ({ ...s, [saved.id]: count >= TOTAL_SUBTITLE_LANGS ? '✓ All languages ready' : `✓ ${count} lang` }))
                            setSubtitlePhase(s => ({ ...s, [saved.id]: 'done' }))
                        }
                    })
                    .catch(() => {})
            }
            setShowModal(false)
            // Auto-trigger server-side subtitle worker when filmUrl is added/changed
            if (saved.filmUrl) {
                const prevUrl = editingId ? (projects.find(p => p.id === editingId)?.filmUrl ?? null) : null
                if (saved.filmUrl !== prevUrl) {
                    const pid = saved.id
                    setServerJobStatus(s => ({ ...s, [pid]: 'queued' }))
                    setServerJobMsg(s => ({ ...s, [pid]: '⚡ Auto-submitting to subtitle worker…' }))
                    fetch('/api/subtitles/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ projectId: pid, videoUrl: saved.filmUrl }),
                    }).then(async r => {
                        const d = await r.json().catch(() => ({}))
                        if (r.ok && d.jobId) {
                            setServerJobId(s => ({ ...s, [pid]: d.jobId }))
                            setServerJobMsg(s => ({ ...s, [pid]: '🤖 Subtitle job queued — worker is transcribing in the background.' }))
                            pollServerJob(pid, d.jobId)
                        } else if (r.status === 409) {
                            setServerJobStatus(s => ({ ...s, [pid]: d.status ?? 'processing' }))
                            setServerJobMsg(s => ({ ...s, [pid]: '♻️ A subtitle job is already active for this project.' }))
                            if (d.jobId) pollServerJob(pid, d.jobId)
                        } else {
                            setServerJobStatus(s => ({ ...s, [pid]: 'failed' }))
                            setServerJobMsg(s => ({ ...s, [pid]: '⚠️ Worker not reachable. Set WORKER_URL in Vercel env, or use the manual button.' }))
                        }
                    }).catch(() => {
                        setServerJobStatus(s => ({ ...s, [pid]: 'failed' }))
                        setServerJobMsg(s => ({ ...s, [pid]: '⚠️ Could not reach worker. Use the manual button to retry.' }))
                    })
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save')
        } finally {
            setSaving(false)
        }
    }

    // Form submit — normal path (no override).
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        await doSave(false)
    }

    // Called when admin explicitly confirms they want to publish without full translations.
    const handlePublishOverride = async () => {
        setShowPublishWarning(false)
        await doSave(true)
    }

    /** Poll the server job status every 5s until terminal state */
    const pollServerJob = (pid: string, jobId: string) => {
        let attempts = 0
        const iv = setInterval(async () => {
            attempts++
            if (attempts > 120) {
                clearInterval(iv)
                setServerJobStatus(s => ({ ...s, [pid]: 'failed' }))
                setServerJobMsg(s => ({ ...s, [pid]: '⏱ Polling timed out (10 min). Check worker logs.' }))
                return
            }
            try {
                const r = await fetch(`/api/subtitles/status/${jobId}`)
                if (!r.ok) return
                const d = await r.json()
                setServerJobStatus(s => ({ ...s, [pid]: d.status }))
                if (d.status === 'ready') {
                    clearInterval(iv)
                    setServerJobMsg(s => ({ ...s, [pid]: '✅ Subtitles ready! You can now run translation.' }))
                    fetch(`/api/subtitles/${pid}?lang=en`).then(r2 => r2.json()).then(sub => {
                        setTranslationCount(s => ({ ...s, [pid]: sub.available?.length ?? 0 }))
                        setTranslateStatus(s => ({ ...s, [pid]: sub.translateStatus ?? 'pending' }))
                    }).catch(() => {})
                } else if (d.status === 'failed') {
                    clearInterval(iv)
                    setServerJobMsg(s => ({ ...s, [pid]: `❌ Worker failed: ${d.errorMessage || 'unknown'}` }))
                } else if (d.status === 'processing') {
                    setServerJobMsg(s => ({ ...s, [pid]: '🔄 Worker is transcribing… (may take several minutes)' }))
                }
            } catch { /* ignore transient errors */ }
        }, 5000)
    }

    /** Manually trigger server-side subtitle generation */
    const handleServerGenerate = async (pid: string, filmUrl: string) => {
        const cur = serverJobStatus[pid]
        if (cur === 'queued' || cur === 'processing') return
        setServerJobStatus(s => ({ ...s, [pid]: 'queued' }))
        setServerJobMsg(s => ({ ...s, [pid]: '⚡ Sending to worker…' }))
        try {
            const r = await fetch('/api/subtitles/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: pid, videoUrl: filmUrl }),
            })
            const d = await r.json().catch(() => ({}))
            if (r.ok && d.jobId) {
                setServerJobId(s => ({ ...s, [pid]: d.jobId }))
                setServerJobMsg(s => ({ ...s, [pid]: '🤖 Job queued — worker is processing in background.' }))
                pollServerJob(pid, d.jobId)
            } else if (r.status === 409) {
                setServerJobStatus(s => ({ ...s, [pid]: d.status ?? 'processing' }))
                setServerJobMsg(s => ({ ...s, [pid]: '♻️ A subtitle job is already active.' }))
                if (d.jobId) pollServerJob(pid, d.jobId)
            } else {
                setServerJobStatus(s => ({ ...s, [pid]: 'failed' }))
                setServerJobMsg(s => ({ ...s, [pid]: `⚠️ ${d.error || "Worker not reachable. Is it running?"}` }))
            }
        } catch {
            setServerJobStatus(s => ({ ...s, [pid]: 'failed' }))
            setServerJobMsg(s => ({ ...s, [pid]: '⚠️ Network error reaching worker.' }))
        }
    }

    /**
     * Handle manual SRT/VTT transcript upload.
     * Delegates all parsing and API logic to subtitle-file-parser.ts (SRP fix).
     * This function only wires React state setters to the upload callbacks.
     */
    const handleSrtUpload = async (projectId: string, file: File) => {
        const pid = projectId
        await uploadSubtitleFile(pid, file, {
            onPhase:    (phase) => setSubtitlePhase(s    => ({ ...s, [pid]: phase })),
            onStatus:   (msg)   => setSubtitleStatus(s   => ({ ...s, [pid]: msg })),
            onProgress: (pct)   => setSubtitleProgress(s => ({ ...s, [pid]: pct })),
            onCountReady: () => {
                setTranslationCount(s => ({ ...s, [pid]: 1 })) // English only at this point
                setTranslateStatus(s  => ({ ...s, [pid]: 'pending' }))
            },
            onError: setError,
        })
    }


    /**
     * Generate or resume multi-language subtitles for a project.
     * Extracted from inline card handler so it can be called from the edit modal.
     */
    const handleGenerateSubtitles = async (pid: string, filmUrl: string) => {
        const isRunning = subtitlePhase[pid] === 'transcribing' || subtitlePhase[pid] === 'translating'
        if (isRunning) return

        // Clear any previous error so stale messages don't persist on retry
        setError('')
        setSubtitleStatus(s => ({ ...s, [pid]: '' }))
        setSubtitlePhase(s => ({ ...s, [pid]: null }))
        setSubtitleProgress(s => ({ ...s, [pid]: 0 }))

        const isResume = translateStatus[pid] === 'partial'
        // Skip browser transcription if the server worker already produced an English
        // transcript, or if any translation already exists (meaning transcript is in DB).
        const hasWorkerTranscript = serverJobStatus[pid] === 'ready'
        const hasExistingTranscript = (translationCount[pid] ?? 0) > 0

        // Fast DB check: if a transcript row exists (even with 0 translations yet),
        // skip the browser Whisper path entirely. This prevents the HuggingFace
        // model-load error when the server worker has already transcribed the video.
        let hasDbTranscript = hasExistingTranscript || hasWorkerTranscript
        if (!hasDbTranscript && !isResume) {
            try {
                const chk = await fetch(`/api/admin/subtitles?projectId=${pid}`)
                const { subtitle } = await chk.json()
                if (subtitle?.segments) hasDbTranscript = true
            } catch { /* ignore — fall through to browser path */ }
        }

        if (!isResume && !hasDbTranscript) {
            // Note: we no longer block streaming URLs here — transcribeVideo will
            // try a direct fetch first then fall back to the server-side proxy,
            // so CORS-restricted hosts can still be transcribed.
            const { hostname: filmHost } = isBlockedStreamingUrl(filmUrl)
            if (filmHost) {
                setSubtitleStatus(s => ({ ...s, [pid]: `⏳ Routing via server proxy for ${filmHost}...` }))
            }
            setSubtitlePhase(s => ({ ...s, [pid]: 'transcribing' }))
            setSubtitleStatus(s => ({ ...s, [pid]: '⏳ Loading audio engine...' }))
            setSubtitleProgress(s => ({ ...s, [pid]: 2 }))
            try {
                const result = await transcribeVideo(filmUrl, (status, detail) => {
                    setSubtitleStatus(s => ({ ...s, [pid]: `⏳ ${detail || status}` }))
                    const phaseProgress: Record<string, number> = {
                        'loading-ffmpeg': 5, 'extracting-audio': 15,
                        'loading-model': 25, 'transcribing': 42,
                    }
                    setSubtitleProgress(s => ({ ...s, [pid]: phaseProgress[status] || s[pid] || 0 }))
                })
                const qcSummary = runQC(result.segments)
                setSubtitleStatus(s => ({ ...s, [pid]: '💾 Saving transcript...' }))
                setSubtitleProgress(s => ({ ...s, [pid]: 48 }))
                await fetch('/api/admin/subtitles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId: pid, language: 'en', segments: result.segments,
                        transcribedWith: 'whisper-medium', qcIssues: qcSummary.results, status: 'pending',
                    }),
                })
                setSubtitleProgress(s => ({ ...s, [pid]: 50 }))
                setSubtitleStatus(s => ({ ...s, [pid]: `✅ Transcript saved — ${formatQCSummary(qcSummary)}` }))
                setError('') // clear any prior error after success
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'error'
                setSubtitleStatus(s => ({ ...s, [pid]: `❌ Transcription failed: ${msg}` }))
                setError(`Transcription failed: ${msg}`)
                setSubtitlePhase(s => ({ ...s, [pid]: 'error' }))
                setSubtitleProgress(s => ({ ...s, [pid]: 0 }))
                return
            }
        } else {
            setSubtitleProgress(s => ({ ...s, [pid]: 50 }))
        }

        setSubtitlePhase(s => ({ ...s, [pid]: 'translating' }))
        setSubtitleStatus(s => ({ ...s, [pid]: '🌍 Starting server translation...' }))
        try {
            const res = await fetch('/api/admin/subtitles/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: pid }),
            })
            if (!res.ok || !res.body) {
                const err = await res.json().catch(() => ({}))
                throw new Error((err as {error?: string}).error || `HTTP ${res.status}`)
            }
            let completed = 0
            await readSSEStream<{
                phase?: string; lang?: string; langName?: string;
                pct?: number; total?: number; completed?: number;
                allDone?: boolean; error?: string;
            }>(res.body.getReader(), (data) => {
                if (data.phase === 'translating' && data.langName) {
                    setSubtitleStatus(s => ({ ...s, [pid]: `🌍 Translating ${data.langName}...` }))
                    setSubtitleProgress(s => ({ ...s, [pid]: 50 + Math.round((data.pct ?? 0) * 0.48) }))
                } else if (data.phase === 'done') {
                    completed++
                    setTranslationCount(s => ({ ...s, [pid]: completed + 1 }))
                } else if (data.phase === 'complete') {
                    const allDone = data.allDone ?? false
                    setSubtitleProgress(s => ({ ...s, [pid]: 100 }))
                    setSubtitleStatus(s => ({ ...s, [pid]: allDone ? `✓ All ${TOTAL_SUBTITLE_LANGS} languages ready` : `✓ ${completed + 1} languages ready` }))
                    setSubtitlePhase(s => ({ ...s, [pid]: 'done' }))
                    setTranslateStatus(s => ({ ...s, [pid]: allDone ? 'complete' : 'partial' }))
                    setTranslationCount(s => ({ ...s, [pid]: allDone ? TOTAL_SUBTITLE_LANGS : completed + 1 }))
                } else if (data.phase === 'error' && data.lang) {
                    setSubtitleStatus(s => ({ ...s, [pid]: `⚠️ ${data.lang} failed — continuing...` }))
                }
            })
        } catch (err) {
            setSubtitleStatus(s => ({ ...s, [pid]: `❌ Translation error: ${err instanceof Error ? err.message : 'error'}` }))
            setSubtitlePhase(s => ({ ...s, [pid]: 'error' }))
            setTranslateStatus(s => ({ ...s, [pid]: 'partial' }))
        }
    }

    const handleDelete = async (id: string, title: string) => {
        if (!confirm(`Delete "${title}"? This will also delete all its casting calls and applications.`)) return
        setDeleting(id)
        try {
            const res = await fetch(`/api/admin/projects/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error()
            setProjects(prev => prev.filter(p => p.id !== id))
        } catch {
            alert('Failed to delete project')
        } finally {
            setDeleting(null)
        }
    }

    const updateField = (field: keyof FormData, value: string | boolean) =>
        setForm(f => ({ ...f, [field]: value }))

    const openReview = async (projectId: string, title: string) => {
        const requestId = ++reviewRequestRef.current
        setReviewProjectId(projectId)
        setReviewProjectTitle(title)
        setReviewLang('en')
        setReviewData(null)
        setReviewLoading(true)
        setRetryingLang(null)
        try {
            const res = await fetch(`/api/admin/subtitles?projectId=${projectId}`)
            const { subtitle } = await res.json()
            if (requestId !== reviewRequestRef.current) return
            if (subtitle) {
                setReviewData({
                    segments: JSON.parse(subtitle.segments || '[]'),
                    translations: subtitle.translations ? JSON.parse(subtitle.translations) : {},
                    qcIssues: subtitle.qcIssues ? JSON.parse(subtitle.qcIssues) : [],
                    translateStatus: subtitle.translateStatus || 'pending',
                    transcribedWith: subtitle.transcribedWith || null,
                    generatedWith: subtitle.generatedWith || null,
                    langStatus: subtitle.langStatus ?? null,
                })
            }
        } catch { /* subtitle not found */ }
        if (requestId === reviewRequestRef.current) setReviewLoading(false)
    }

    /** Open the subtitle editor for a project */
    const openSubtitleEditor = async (projectId: string, filmUrl: string | null) => {
        try {
            const res = await fetch(`/api/admin/subtitles?projectId=${projectId}`)
            const { subtitle } = await res.json()
            if (!subtitle) { alert('No subtitles found for this project. Generate them first.'); return }
            const segs: SubtitleCue[] = JSON.parse(subtitle.segments || '[]')
            
            // Fix #5: null-coalesce every field — old records predate mobile columns and
            // would produce undefined values that override DEFAULT_PLACEMENT defaults in useState.
            setEditorInitialPlacement({
                verticalAnchor:   subtitle.verticalAnchor   ?? 'bottom',
                horizontalAlign:  subtitle.horizontalAlign  ?? 'center',
                offsetYPercent:   subtitle.offsetYPercent   ?? 0,
                offsetXPercent:   subtitle.offsetXPercent   ?? 0,
                safeAreaMarginPx: subtitle.safeAreaMarginPx ?? 12,
                backgroundStyle:  subtitle.backgroundStyle  ?? 'shadow',
                fontScale:        subtitle.fontScale        ?? 1.0,
                cueOverrides: subtitle.cueOverrides
                    ? (typeof subtitle.cueOverrides === 'string' ? JSON.parse(subtitle.cueOverrides) : subtitle.cueOverrides)
                    : {},
            })
            // Mobile portrait placement — stored as individual columns, NOT a JSON field
            setEditorInitialMobilePlacement({
                verticalAnchor:   subtitle.mobileVerticalAnchor   ?? 'bottom',
                horizontalAlign:  subtitle.mobileHorizontalAlign  ?? 'center',
                offsetYPercent:   subtitle.mobileOffsetYPercent   ?? 0,
                offsetXPercent:   subtitle.mobileOffsetXPercent   ?? 0,
                safeAreaMarginPx: subtitle.mobileSafeAreaMarginPx ?? 20,
                fontScale:        subtitle.mobileFontScale        ?? 0.9,
            })
            setEditorInitialLandscapePlacement({
                verticalAnchor:   subtitle.landscapeVerticalAnchor   ?? 'bottom',
                horizontalAlign:  subtitle.landscapeHorizontalAlign  ?? 'center',
                offsetYPercent:   subtitle.landscapeOffsetYPercent   ?? 0,
                offsetXPercent:   subtitle.landscapeOffsetXPercent   ?? 0,
                safeAreaMarginPx: subtitle.landscapeSafeAreaMarginPx ?? 20,
                fontScale:        subtitle.landscapeFontScale        ?? 0.9,
            })
            setEditorUseSeparateMobile(subtitle.useSeparateMobilePlacement ?? false)
            
            setEditorSegments(segs)
            setEditorFilmUrl(filmUrl)
            setEditorStatus(subtitle.status || 'pending')
            setEditorProjectId(projectId)
        } catch {
            alert('Could not load subtitles. Try again.')
        }
    }

    /** Retry a single failed/pending language via SSE */
    const retryLang = async (lang: string) => {
        if (!reviewProjectId || retryingLang === lang) return
        setRetryingLang(lang)
        try {
            const res = await fetch('/api/admin/subtitles/retry-lang', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: reviewProjectId, lang }),
            })
            if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
            // Optimistically mark as processing in the UI
            setReviewData(prev => prev ? {
                ...prev,
                langStatus: { ...(prev.langStatus ?? {}), [lang]: 'processing' },
            } : prev)
            await readSSEStream<{ phase?: string; lang?: string }>(res.body.getReader(), async (data) => {
                if (data.phase === 'done') {
                    // Refresh subtitle data from server
                    const freshRes = await fetch(`/api/admin/subtitles?projectId=${reviewProjectId}`)
                    const { subtitle } = await freshRes.json()
                    if (subtitle) {
                        setReviewData({
                            segments: JSON.parse(subtitle.segments || '[]'),
                            translations: subtitle.translations ? JSON.parse(subtitle.translations) : {},
                            qcIssues: subtitle.qcIssues ? JSON.parse(subtitle.qcIssues) : [],
                            translateStatus: subtitle.translateStatus || 'pending',
                            transcribedWith: subtitle.transcribedWith || null,
                            generatedWith: subtitle.generatedWith || null,
                            langStatus: subtitle.langStatus ?? null,
                        })
                    }
                } else if (data.phase === 'error') {
                    setReviewData(prev => prev ? {
                        ...prev,
                        langStatus: { ...(prev.langStatus ?? {}), [lang]: 'failed' },
                    } : prev)
                }
            })
        } catch (err) {
            setReviewData(prev => prev ? {
                ...prev,
                langStatus: { ...(prev.langStatus ?? {}), [lang]: 'failed' },
            } : prev)
            console.error('[retry-lang]', err)
        }
        setRetryingLang(null)
    }

    const closeReview = () => {
        setReviewProjectId(null)
        setReviewData(null)
    }

    const openCastModal = async (projectId: string, title: string) => {
        setCastProjectId(projectId)
        setCastProjectTitle(title)
        setCastMembers([])
        setCastForm(EMPTY_CAST_FORM)
        setCastError('')
        setCastLoading(true)
        try {
            const res = await fetch(`/api/admin/cast?projectId=${projectId}`)
            const { cast } = await res.json()
            setCastMembers(cast || [])
        } catch { /* ignore */ }
        setCastLoading(false)
    }

    const closeCastModal = () => { setCastProjectId(null); setCastMembers([]) }

    const handleAddCastMember = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!castForm.name.trim() || !castForm.jobTitle.trim()) {
            setCastError('Name and Job Title are required')
            return
        }
        setCastSaving(true)
        setCastError('')
        try {
            const res = await fetch('/api/admin/cast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: castProjectId, ...castForm, sortOrder: castMembers.length }),
            })
            if (!res.ok) throw new Error()
            const { member } = await res.json()
            setCastMembers(prev => [...prev, member])
            setCastForm(EMPTY_CAST_FORM)
        } catch { setCastError('Failed to add member') }
        setCastSaving(false)
    }

    const handleDeleteCastMember = async (id: string) => {
        if (!confirm('Remove this cast member?')) return
        try {
            await fetch(`/api/admin/cast/${id}`, { method: 'DELETE' })
            setCastMembers(prev => prev.filter(m => m.id !== id))
        } catch { alert('Failed to delete') }
    }

    const handleTranslateCastMember = async (m: FilmCastMember) => {
        if (!m.bio && !m.character) {
            alert('Add a bio or character name first before translating.')
            return
        }
        setTranslatingId(m.id)
        try {
            const res = await fetch(`/api/admin/cast/${m.id}/translate`, { method: 'POST' })
            if (!res.ok) throw new Error()
            const { member } = await res.json()
            setCastMembers(prev => prev.map(c => c.id === m.id ? { ...c, bioTranslations: member.bioTranslations } : c))
        } catch { alert('Translation failed — check API key or try again.') }
        setTranslatingId(null)
    }

    return (
        <div className="admin-layout">
            <AdminSidebar />

            <main className="admin-main" style={showModal ? { display: 'none' } : undefined}>
                <div className="admin-header">
                    <h1 className="admin-page-title">Projects</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>{projects.length} total</span>
                        <button onClick={openCreate} className="btn btn-primary btn-sm">+ New Project</button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid-4" style={{ marginBottom: 'var(--space-2xl)' }}>
                    <div className="stat-card">
                        <div className="stat-card-label">Total Projects</div>
                        <div className="stat-card-value">{projects.length}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-label">Completed</div>
                        <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                            {projects.filter(p => p.status === 'completed').length}
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-label">In Production</div>
                        <div className="stat-card-value" style={{ color: 'var(--accent-gold)' }}>
                            {projects.filter(p => p.status === 'in-production').length}
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-label">Upcoming</div>
                        <div className="stat-card-value" style={{ color: 'var(--accent-blue, #60a5fa)' }}>
                            {projects.filter(p => p.status === 'upcoming').length}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto var(--space-md)' }} />
                        Loading projects...
                    </div>
                ) : projects.length === 0 ? (
                    <div style={{
                        padding: 'var(--space-4xl) var(--space-2xl)',
                        textAlign: 'center',
                        color: 'var(--text-tertiary)',
                        background: 'linear-gradient(180deg, var(--bg-secondary) 0%, rgba(13,15,20,0.6) 100%)',
                        borderRadius: 'var(--radius-xl)',
                        border: '1px solid var(--border-subtle)',
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        {/* Decorative top gold line */}
                        <div style={{
                            position: 'absolute', top: 0, left: '25%', right: '25%', height: '2px',
                            background: 'linear-gradient(90deg, transparent, var(--accent-gold), transparent)',
                        }} />
                        <div style={{
                            fontSize: '3.5rem', marginBottom: 'var(--space-lg)',
                            filter: 'drop-shadow(0 4px 12px rgba(212,168,83,0.2))',
                        }}>🎬</div>
                        <h3 style={{
                            fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)',
                            marginBottom: 'var(--space-xs)',
                        }}>
                            Your <span style={{
                                fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                                background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}>stage</span> awaits
                        </h3>
                        <p style={{
                            maxWidth: '380px', margin: '0 auto', lineHeight: 1.7,
                            fontSize: '0.9rem', marginBottom: 'var(--space-xl)',
                        }}>
                            Every great studio starts with its first project. Add a film, series, or short and bring your vision to life.
                        </p>
                        <button onClick={openCreate} className="btn btn-primary btn-lg" style={{ gap: '6px' }}>
                            + Create Your First Project
                        </button>
                        <div style={{
                            fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-lg)',
                            opacity: 0.6, display: 'flex', justifyContent: 'center', alignItems: 'center',
                            gap: '4px', width: '100%',
                        }}>
                            💡 Tip: Add a cover image and trailer to make your project shine on the public site.
                        </div>
                    </div>
                ) : (
                    <>
                    {/* Sort / filter bar */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        marginBottom: 'var(--space-md)',
                        padding: '8px 12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--border-subtle)',
                    }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: '4px' }}>Sort by</span>
                        {(['default', 'views'] as const).map(opt => (
                            <button
                                key={opt}
                                onClick={() => setSortBy(opt)}
                                style={{
                                    padding: '3px 12px', borderRadius: 'var(--radius-full)',
                                    fontSize: '0.72rem', fontWeight: 700, border: 'none', cursor: 'pointer',
                                    background: sortBy === opt ? 'var(--accent-gold)' : 'rgba(255,255,255,0.05)',
                                    color: sortBy === opt ? '#0a0a0a' : 'var(--text-tertiary)',
                                    transition: 'all 0.15s',
                                }}
                            >
                                {opt === 'default' ? '📋 Manual order' : '👁️ Most viewed'}
                            </button>
                        ))}
                        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                            {projects.length} project{projects.length !== 1 ? 's' : ''} · {projects.reduce((s, p) => s + p.viewCount, 0).toLocaleString()} total views
                        </span>
                    </div>
                    <div className="grid-auto-fill">
                        {[...projects].sort((a, b) => sortBy === 'views' ? b.viewCount - a.viewCount : 0).map((project, idx, arr) => {
                            const status = statusConfig[project.status] || statusConfig.upcoming
                            const maxViews = Math.max(...arr.map(p => p.viewCount), 1)
                            const viewPct = Math.round((project.viewCount / maxViews) * 100)
                            const isTrending = sortBy === 'views' ? idx === 0 : project.viewCount === maxViews && project.viewCount > 0
                            return (
                                <div key={project.id} className="glass-card" style={{ overflow: 'hidden', opacity: deleting === project.id ? 0.4 : 1, transition: 'opacity 0.3s' }}>
                                    {/* Cover Image */}
                                    <div style={{
                                        height: '160px',
                                        backgroundImage: project.coverImage ? `url(${project.coverImage})` : 'linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary))',
                                        backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative',
                                    }}>
                                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, var(--bg-glass) 100%)' }} />
                                        <div style={{ position: 'absolute', top: 'var(--space-md)', right: 'var(--space-md)', display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                            <span className={`badge ${status.className}`}>{status.label}</span>
                                            {project.published && <span className="badge badge-purple">🌐 Published</span>}
                                            {project.featured && <span className="badge badge-gold">★ Featured</span>}
                                            {isTrending && <span className="badge badge-gold">🔥 Trending</span>}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div style={{ padding: 'var(--space-lg)' }}>
                                        <h3 style={{ marginBottom: '4px' }}>{project.title}</h3>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
                                            {project.genre} {project.year ? `• ${project.year}` : ''} {project.duration ? `• ${project.duration}` : ''}
                                        </div>
                                        <p style={{ fontSize: '0.85rem', lineHeight: 1.6, marginBottom: 'var(--space-md)' }}>
                                            {project.description.length > 120 ? project.description.slice(0, 120) + '...' : project.description}
                                        </p>
                                        {/* Engagement bar */}
                                        <div style={{ marginBottom: 'var(--space-sm)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                                                    👁️ {project.viewCount.toLocaleString()} view{project.viewCount !== 1 ? 's' : ''}
                                                </span>
                                                {viewPct > 0 && (
                                                    <span style={{ fontSize: '0.55rem', color: isTrending ? 'var(--accent-gold)' : 'var(--text-tertiary)', fontWeight: 700 }}>
                                                        {viewPct}% of top
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%', borderRadius: '2px',
                                                    width: `${viewPct}%`,
                                                    background: isTrending
                                                        ? 'linear-gradient(90deg, var(--accent-gold), #e8c547)'
                                                        : 'linear-gradient(90deg, rgba(59,130,246,0.6), rgba(96,165,250,0.4))',
                                                    transition: 'width 0.6s ease',
                                                }} />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                {project._count.castingCalls} casting call{project._count.castingCalls !== 1 ? 's' : ''}
                                            </span>
                                            {/* Translation completeness badge */}
                                            {project.filmUrl && (() => {
                                                const count = translationCount[project.id] ?? -1
                                                const isFull = count >= TOTAL_SUBTITLE_LANGS
                                                const isPartial = count > 0 && count < TOTAL_SUBTITLE_LANGS
                                                const isNone = count === 0
                                                const isPending = count === -1
                                                return (
                                                    <span style={{
                                                        fontSize: '0.62rem', fontWeight: 700,
                                                        padding: '2px 8px', borderRadius: '6px',
                                                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                        background: isFull ? 'rgba(52,211,153,0.1)' : isPartial ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.04)',
                                                        border: `1px solid ${isFull ? 'rgba(52,211,153,0.25)' : isPartial ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.08)'}`,
                                                        color: isFull ? '#34d399' : isPartial ? '#f59e0b' : 'var(--text-tertiary)',
                                                    }}>
                                                        {isPending ? '…' : isFull ? '✅' : isNone ? '🌐' : '⚠️'}
                                                        {isPending ? 'checking' : `${Math.max(0, count)}/${TOTAL_SUBTITLE_LANGS} langs`}
                                                    </span>
                                                )
                                            })()}
                                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                <button
                                                    onClick={() => openCastModal(project.id, project.title)}
                                                    className="btn btn-ghost btn-sm"
                                                    title="Manage cast & crew for this project"
                                                    style={{ fontSize: '0.65rem', fontWeight: 700 }}
                                                >
                                                    🎭 Cast
                                                </button>
                                                <button onClick={() => openEdit(project)} className="btn btn-ghost btn-sm">Edit</button>
                                                <button
                                                    onClick={() => handleDelete(project.id, project.title)}
                                                    disabled={deleting === project.id}
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ color: 'var(--error)' }}
                                                >
                                                    {deleting === project.id ? '...' : '✕'}
                                                </button>
                                        </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    </>
                )}
            </main>
            {/* ── Full-Page Edit View ── */}
            {showModal && (
                <main className="admin-main" style={{ overflowY: 'auto' }}>
                    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
                        {/* Header with Back button */}
                        <div className="admin-header" style={{ marginBottom: 'var(--space-lg)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }}>← Back</button>
                                <h1 className="admin-page-title" style={{ fontSize: '1.3rem' }}>
                                    {editingId ? `✏️ ${form.title || 'Edit Project'}` : '🎬 New Project'}
                                </h1>
                            </div>
                        </div>

                        <form onSubmit={handleSave}>
                            <div className="admin-form-stack" style={{ gap: 'var(--space-md)' }}>
                                {/* Title + Slug */}
                                <div className="admin-form-grid">
                                    <div>
                                        <label className="admin-label">Title *</label>
                                        <input className="admin-input" value={form.title}
                                            onChange={e => { updateField('title', e.target.value); if (!editingId) updateField('slug', slugify(e.target.value)) }}
                                            placeholder="e.g. Neon Saints" required />
                                    </div>
                                    <div>
                                        <label className="admin-label">Slug</label>
                                        <input className="admin-input" value={form.slug}
                                            onChange={e => updateField('slug', e.target.value)}
                                            placeholder="auto-generated" style={{ color: 'var(--text-tertiary)' }} />
                                    </div>
                                </div>

                                {/* Tagline */}
                                <div>
                                    <label className="admin-label">Tagline</label>
                                    <input className="admin-input" value={form.tagline}
                                        onChange={e => updateField('tagline', e.target.value)}
                                        placeholder="A short hook for the project..." />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="admin-label">Description *</label>
                                    <textarea className="admin-textarea" rows={4} value={form.description}
                                        onChange={e => updateField('description', e.target.value)}
                                        placeholder="Full synopsis or description of the project..." required />
                                </div>

                                {/* Genre (multi-select pills), Year, Duration */}
                                <div>
                                    <label className="admin-label">Genre <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(select all that apply)</span></label>
                                    {form.genre && (
                                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                            {form.genre.split(',').filter(Boolean).map(g => (
                                                <span key={g} style={{
                                                    fontSize: '0.65rem', fontWeight: 700,
                                                    color: 'var(--accent-gold)',
                                                    background: 'rgba(212,168,83,0.12)',
                                                    border: '1px solid rgba(212,168,83,0.3)',
                                                    padding: '2px 8px', borderRadius: '20px',
                                                }}>{g.trim()}</span>
                                            ))}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {['Action','Adventure','Animation','Biography','Comedy','Crime','Documentary','Drama','Fantasy','Historical','Horror','Musical','Mystery','Romance','Sci-Fi','Short Film','Thriller','War','Western'].map(g => {
                                            const selected = form.genre?.split(',').map(x => x.trim()).includes(g)
                                            return (
                                                <button key={g} type="button"
                                                    onClick={() => {
                                                        const current = form.genre ? form.genre.split(',').map(x => x.trim()).filter(Boolean) : []
                                                        const next = selected ? current.filter(x => x !== g) : [...current, g]
                                                        updateField('genre', next.join(', '))
                                                    }}
                                                    style={{
                                                        fontSize: '0.65rem', fontWeight: 600,
                                                        padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                                                        border: selected ? '1px solid rgba(212,168,83,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                                        background: selected ? 'rgba(212,168,83,0.15)' : 'rgba(255,255,255,0.04)',
                                                        color: selected ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >{g}</button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Year, Duration */}
                                <div className="admin-form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                    <div>
                                        <label className="admin-label">Year</label>
                                        <input className="admin-input" value={form.year}
                                            onChange={e => updateField('year', e.target.value)}
                                            placeholder="e.g. 2026" />
                                    </div>
                                    <div>
                                        <label className="admin-label">Duration</label>
                                        <input className="admin-input" value={form.duration}
                                            onChange={e => updateField('duration', e.target.value)}
                                            placeholder="e.g. 12 min" />
                                    </div>
                                </div>

                                {/* Status + Featured */}
                                <div className="admin-form-grid">
                                    <div>
                                        <label className="admin-label">Status</label>
                                        <select className="admin-input" value={form.status}
                                            onChange={e => updateField('status', e.target.value)}
                                            style={{ cursor: 'pointer', appearance: 'auto' }}>
                                            {STATUSES.map(s => (
                                                <option key={s} value={s}>
                                                    {s === 'in-production' ? 'In Production' : s.charAt(0).toUpperCase() + s.slice(1)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                                            <input type="checkbox" checked={form.featured}
                                                onChange={e => updateField('featured', e.target.checked)}
                                                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-gold)' }} />
                                            ★ Featured on homepage
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer', fontSize: '0.88rem', color: form.published ? '#c084fc' : 'var(--text-secondary)', fontWeight: form.published ? 700 : 400, transition: 'all 0.2s' }}>
                                            <input type="checkbox" checked={form.published}
                                                onChange={e => updateField('published', e.target.checked)}
                                                style={{ width: '18px', height: '18px', accentColor: '#c084fc' }} />
                                            🌐 Published (visible to public)
                                        </label>

                                        {/* Scheduled publish — only shown when not yet published */}
                                        {!form.published && (
                                            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                                    <span>⏰ Schedule publish:</span>
                                                    <input
                                                        type="datetime-local"
                                                        value={form.publishAt}
                                                        onChange={e => updateField('publishAt', e.target.value)}
                                                        min={(() => { const n = new Date(); return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 16) })()}
                                                        style={{
                                                            padding: '4px 8px', borderRadius: '6px', fontSize: '0.8rem',
                                                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                                            color: 'var(--text-primary)', fontFamily: 'inherit',
                                                        }}
                                                    />
                                                    {form.publishAt && (
                                                        <button onClick={() => updateField('publishAt', '')}
                                                            style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', border: 'none', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer' }}>
                                                            Clear
                                                        </button>
                                                    )}
                                                </label>
                                                {form.publishAt && (
                                                    <p style={{ margin: '6px 0 0 0', fontSize: '0.7rem', color: '#fbbf24' }}>
                                                        ⏳ Will auto-publish {new Date(form.publishAt).toLocaleString()} (your local time)
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Notify Audience — appears when publishing OR scheduling OR re-sending */}
                                    {(form.published || form.publishAt) && !editingId?.startsWith('new') && (
                                        <div style={{
                                            marginTop: 'var(--space-md)',
                                            padding: 'var(--space-md)',
                                            borderRadius: 'var(--radius-lg)',
                                            background: 'rgba(192,132,252,0.04)',
                                            border: '1px solid rgba(192,132,252,0.2)',
                                        }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#c084fc', marginBottom: 'var(--space-sm)' }}>
                                                {wasPublished ? '📩 Re-send Notifications' : form.publishAt ? '📅 Scheduled Publish Audience' : '📨 Notify Audience on Publish'}
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
                                                {wasPublished
                                                    ? 'This project is already published. Select audience groups and click Re-send to notify additional users.'
                                                    : form.publishAt
                                                        ? 'Select who will be notified when the scheduled publish fires. This selection is saved with the project.'
                                                        : <>Select who receives the publish email when you save. Only fires on the <strong style={{ color: 'var(--text-secondary)' }}>first</strong> publish — not on re-saves.</>
                                                }
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
                                                {([
                                                    {
                                                        key: 'subscribers' as const,
                                                        icon: '📬',
                                                        label: 'Newsletter Subscribers',
                                                        desc: 'People who signed up to hear about new content — not logged-in users.',
                                                        recommended: true,
                                                    },
                                                    {
                                                        key: 'members' as const,
                                                        icon: '👥',
                                                        label: 'Registered Members',
                                                        desc: 'Logged-in users with content notifications enabled.',
                                                        recommended: true,
                                                    },
                                                    {
                                                        key: 'cast' as const,
                                                        icon: '🎭',
                                                        label: 'Cast Members',
                                                        desc: 'Users who applied to casting calls on this specific project.',
                                                        recommended: false,
                                                    },
                                                ] as const).map(group => (
                                                    <label key={group.key} style={{
                                                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                                                        cursor: 'pointer', padding: '8px 10px',
                                                        borderRadius: 'var(--radius-md)',
                                                        background: notifyGroups[group.key] ? 'rgba(192,132,252,0.06)' : 'transparent',
                                                        border: `1px solid ${notifyGroups[group.key] ? 'rgba(192,132,252,0.2)' : 'rgba(255,255,255,0.04)'}`,
                                                        transition: 'all 0.15s',
                                                    }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={notifyGroups[group.key]}
                                                            onChange={e => setNotifyGroups(prev => ({ ...prev, [group.key]: e.target.checked }))}
                                                            style={{ width: '15px', height: '15px', accentColor: '#c084fc', marginTop: '1px', flexShrink: 0 }}
                                                        />
                                                        <div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 600, color: notifyGroups[group.key] ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                                                {group.icon} {group.label}
                                                                {group.recommended && (
                                                                    <span style={{ fontSize: '0.58rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)', fontWeight: 700 }}>RECOMMENDED</span>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>{group.desc}</div>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                            {!notifyGroups.subscribers && !notifyGroups.members && !notifyGroups.cast && (
                                                <div style={{ marginTop: 'var(--space-sm)', fontSize: '0.72rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                    ⚠️ No audience selected — {wasPublished ? 'select groups to re-send.' : 'no emails will be sent on publish.'}
                                                </div>
                                            )}
                                            {/* Re-send button for already-published projects */}
                                            {wasPublished && editingId && (
                                                <button
                                                    type="button"
                                                    disabled={resending || (!notifyGroups.subscribers && !notifyGroups.members && !notifyGroups.cast)}
                                                    onClick={async () => {
                                                        if (!confirm('Re-send publish notifications to the selected audience groups? This will send emails NOW.')) return
                                                        setResending(true)
                                                        try {
                                                            const res = await fetch(`/api/admin/projects/${editingId}/resend`, {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ notifyGroups }),
                                                            })
                                                            if (res.ok) {
                                                                alert('✅ Notifications queued for the selected audience.')
                                                            } else {
                                                                const data = await res.json()
                                                                alert(`❌ ${data.error || 'Failed to queue notifications.'}`)
                                                            }
                                                        } catch {
                                                            alert('❌ Network error.')
                                                        } finally {
                                                            setResending(false)
                                                        }
                                                    }}
                                                    style={{
                                                        marginTop: 'var(--space-md)', padding: '8px 18px',
                                                        borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                                        fontSize: '0.8rem', fontWeight: 700,
                                                        background: (!notifyGroups.subscribers && !notifyGroups.members && !notifyGroups.cast)
                                                            ? 'rgba(255,255,255,0.04)'
                                                            : 'rgba(192,132,252,0.12)',
                                                        border: `1px solid ${(!notifyGroups.subscribers && !notifyGroups.members && !notifyGroups.cast) ? 'rgba(255,255,255,0.06)' : 'rgba(192,132,252,0.3)'}`,
                                                        color: (!notifyGroups.subscribers && !notifyGroups.members && !notifyGroups.cast) ? 'var(--text-tertiary)' : '#c084fc',
                                                        opacity: resending ? 0.6 : 1,
                                                    }}
                                                >
                                                    {resending ? '⏳ Sending...' : '📩 Re-send Notifications'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Cover Image — Drag & Drop */}
                                <FileUploader
                                    label="Cover Image"
                                    accept="image/*"
                                    category="covers"
                                    currentUrl={form.coverImage}
                                    onUpload={url => updateField('coverImage', url)}
                                    maxSizeMB={10}
                                    compact
                                />

                                {/* Media Section */}
                                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-md)' }}>
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--accent-gold)', marginBottom: 'var(--space-md)' }}>
                                        Media & Content
                                    </div>
                                    <div className="admin-form-grid">
                                        <div>
                                            <label className="admin-label">Project Type</label>
                                            <select className="admin-input" value={form.projectType}
                                                onChange={e => updateField('projectType', e.target.value)}
                                                style={{ cursor: 'pointer', appearance: 'auto' }}>
                                                <option value="movie">Movie</option>
                                                <option value="series">Series</option>
                                            </select>
                                        </div>
                                        <div />
                                    </div>

                                    {/* Trailer — Drag & Drop */}
                                    <div style={{ marginTop: 'var(--space-md)' }}>
                                        <FileUploader
                                            label="Trailer (public)"
                                            accept="video/*"
                                            category="trailers"
                                            currentUrl={form.trailerUrl}
                                            onUpload={url => updateField('trailerUrl', url)}
                                            maxSizeMB={100}
                                            compact
                                        />
                                    </div>

                                    {/* Full Film — Drag & Drop */}
                                    <div style={{ marginTop: 'var(--space-md)' }}>
                                        <FileUploader
                                            label="Full Film (members only)"
                                            accept="video/*"
                                            category="films"
                                            currentUrl={form.filmUrl}
                                            onUpload={url => updateField('filmUrl', url)}
                                            maxSizeMB={500}
                                        />
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                            When set, a &quot;Watch Now&quot; button appears on the project page (login required).
                                        </div>
                                    </div>
                                </div>

                                {/* —— Gallery & Credits —— */}
                                <div className="glass-card" style={{ padding: 'var(--space-xl)', marginTop: 'var(--space-lg)' }}>
                                    <h4 style={{ marginBottom: 'var(--space-md)', fontSize: '0.95rem', fontWeight: 700 }}>📸 Gallery & Credits</h4>
                                    <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 'var(--space-md)' }}>
                                        <div>
                                            <label className="form-label" htmlFor="gallery">Gallery Media <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>(images &amp; videos — one URL per line)</span></label>
                                            <textarea
                                                id="gallery"
                                                className="form-input"
                                                rows={3}
                                                placeholder={"https://cdn.example.com/still-1.jpg\nhttps://cdn.example.com/bts-clip.mp4\nhttps://cdn.example.com/still-2.jpg"}
                                                value={form.gallery || ''}
                                                onChange={e => updateField('gallery', e.target.value)}
                                                style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="form-label" htmlFor="credits">Credits <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>(one per line: Role — Name)</span></label>
                                            <textarea
                                                id="credits"
                                                className="form-input"
                                                rows={4}
                                                placeholder={"Director — Jane Doe\nProducer — John Smith\nEditor — Alex Kim"}
                                                value={form.credits || ''}
                                                onChange={e => updateField('credits', e.target.value)}
                                                style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* —— Sponsor —— */}
                                <div className="glass-card" style={{ padding: 'var(--space-xl)', marginTop: 'var(--space-lg)' }}>
                                    <h4 style={{ marginBottom: 'var(--space-md)', fontSize: '0.95rem', fontWeight: 700 }}>🤝 Project Sponsor</h4>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
                                        Sponsor info will appear in the publish email sent to all subscribers.
                                    </p>
                                    {(() => {
                                        let sd: { name?: string; logoUrl?: string; description?: string } = {}
                                        try { if (form.sponsorData) sd = JSON.parse(form.sponsorData) } catch { /* ignore */ }
                                        const updateSponsor = (field: string, value: string) => {
                                            const current = { ...sd, [field]: value }
                                            // Clean empty object
                                            if (!current.name && !current.logoUrl && !current.description) {
                                                updateField('sponsorData', '')
                                            } else {
                                                updateField('sponsorData', JSON.stringify(current))
                                            }
                                        }
                                        return (
                                            <div className="form-grid" style={{ gridTemplateColumns: '1fr', gap: 'var(--space-md)' }}>
                                                <div>
                                                    <label className="form-label" htmlFor="sponsorName">Sponsor Name</label>
                                                    <input
                                                        id="sponsorName"
                                                        className="form-input"
                                                        placeholder="e.g. Acme Studios"
                                                        value={sd.name || ''}
                                                        onChange={e => updateSponsor('name', e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="form-label" htmlFor="sponsorLogo">Sponsor Logo URL</label>
                                                    <input
                                                        id="sponsorLogo"
                                                        className="form-input"
                                                        placeholder="https://cdn.example.com/sponsor-logo.png"
                                                        value={sd.logoUrl || ''}
                                                        onChange={e => updateSponsor('logoUrl', e.target.value)}
                                                    />
                                                    {sd.logoUrl && (
                                                        <div style={{ marginTop: 8 }}>
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img src={sd.logoUrl} alt="Sponsor logo preview" style={{ maxWidth: 160, maxHeight: 60, borderRadius: 6, background: 'var(--bg-tertiary)', padding: 4 }} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="form-label" htmlFor="sponsorDesc">Short Description</label>
                                                    <input
                                                        id="sponsorDesc"
                                                        className="form-input"
                                                        placeholder="Brief description of the sponsor"
                                                        value={sd.description || ''}
                                                        onChange={e => updateSponsor('description', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </div>

                                {/* —— Subtitles & Translation —— */}
                                {editingId && (() => {
                                    const pid = editingId
                                    const project = projects.find(p => p.id === pid)
                                    const filmUrl = project?.filmUrl || form.filmUrl
                                    if (!filmUrl) return null
                                    const count = translationCount[pid] ?? 0
                                    const isFull = count >= TOTAL_SUBTITLE_LANGS
                                    const isPartial = count > 0 && count < TOTAL_SUBTITLE_LANGS
                                    const phase = subtitlePhase[pid]
                                    const isRunning = phase === 'transcribing' || phase === 'translating'
                                    const progress = subtitleProgress[pid] ?? 0
                                    const statusMsg = subtitleStatus[pid] || ''
                                    return (
                                        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-md)' }}>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'var(--accent-gold)', marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                🌍 Subtitles & Translation
                                                <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 8px', borderRadius: '99px', textTransform: 'none', background: isFull ? 'rgba(52,211,153,0.1)' : isPartial ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isFull ? 'rgba(52,211,153,0.3)' : isPartial ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.08)'}`, color: isFull ? '#34d399' : isPartial ? '#f59e0b' : 'var(--text-tertiary)' }}>
                                                    {isFull ? `✅ ${count}/${TOTAL_SUBTITLE_LANGS}` : `${count}/${TOTAL_SUBTITLE_LANGS} langs`}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)', lineHeight: 1.5 }}>
                                                {isFull ? 'All languages have been translated. You may regenerate if needed.'
                                                    : isPartial ? `${count} of ${TOTAL_SUBTITLE_LANGS} languages translated. Click CC to translate the remaining — already translated languages are preserved.`
                                                    : 'Generate multi-language subtitles for this film. Click CC to auto-transcribe and translate, or upload an existing SRT/VTT file.'}
                                            </div>
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: 'var(--space-md)' }}>
                                                {/* ── Server Worker Button (recommended) ── */}
                                                {(() => {
                                                    const sS = serverJobStatus[pid] as string | undefined
                                                    const sMsg = serverJobMsg[pid] || ''
                                                    const isActive = sS === 'queued' || sS === 'processing'
                                                    const btnLabel = isActive ? (sS === 'processing' ? '🔄 Transcribing…' : '⏳ Queued…') : sS === 'ready' ? '🤖 Re-generate (Server)' : sS === 'failed' ? '🔁 Retry (Server)' : '🤖 Generate (Server Worker)'
                                                    const c = sS === 'ready' ? '#34d399' : sS === 'failed' ? '#f87171' : '#818cf8'
                                                    return (<>
                                                        {sMsg && (
                                                            <div style={{ width: '100%', fontSize: '0.7rem', padding: '7px 10px', borderRadius: '8px',
                                                                background: sS === 'ready' ? 'rgba(52,211,153,0.06)' : sS === 'failed' ? 'rgba(248,113,113,0.06)' : 'rgba(129,140,248,0.06)',
                                                                border: `1px solid ${sS === 'ready' ? 'rgba(52,211,153,0.2)' : sS === 'failed' ? 'rgba(248,113,113,0.2)' : 'rgba(129,140,248,0.2)'}`,
                                                                color: sS === 'ready' ? '#34d399' : sS === 'failed' ? '#f87171' : '#a5b4fc',
                                                                marginBottom: '4px', lineHeight: 1.5 }}>
                                                                {sMsg}
                                                            </div>
                                                        )}
                                                        <button type="button" onClick={() => handleServerGenerate(pid, filmUrl)} disabled={isActive} className="btn btn-sm"
                                                            title="Runs faster-whisper on your local worker. Fires automatically when video is saved."
                                                            style={{ fontSize: '0.72rem', fontWeight: 700, background: isActive ? 'rgba(255,255,255,0.04)' : 'rgba(129,140,248,0.12)', border: `1px solid ${isActive ? 'rgba(255,255,255,0.08)' : 'rgba(129,140,248,0.3)'}`, color: isActive ? 'var(--text-tertiary)' : c, cursor: isActive ? 'not-allowed' : 'pointer' }}>
                                                            {btnLabel}
                                                        </button>
                                                    </>)
                                                })()}
                                                <div style={{ width: '100%', fontSize: '0.6rem', color: 'var(--text-tertiary)', opacity: 0.55, marginBottom: '-2px' }}>
                                                    ⬆ Server worker — fires automatically on video save &nbsp;·&nbsp; ⬇ Browser fallback — manual only
                                                </div>
                                                <button type="button" onClick={() => handleGenerateSubtitles(pid, filmUrl)} disabled={isRunning} className="btn btn-sm" style={{ fontSize: '0.72rem', fontWeight: 700, background: isRunning ? 'rgba(255,255,255,0.04)' : 'rgba(212,168,83,0.12)', border: `1px solid ${isRunning ? 'rgba(255,255,255,0.08)' : 'rgba(212,168,83,0.3)'}`, color: isRunning ? 'var(--text-tertiary)' : 'var(--accent-gold)', cursor: isRunning ? 'not-allowed' : 'pointer' }}>
                                                    {phase === 'transcribing' ? '⏳ Transcribing…' : phase === 'translating' ? '🌍 Translating…' : translateStatus[pid] === 'partial' ? '↻ Resume Translation' : isFull ? 'CC ✓ Regenerate' : '🎬 Generate Subtitles (CC)'}
                                                </button>
                                                <label title="Upload an existing SRT or VTT transcript" className="btn btn-sm" style={{ fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                                                    📄 Upload SRT / VTT
                                                    <input type="file" accept=".srt,.vtt" style={{ display: 'none' }} onChange={async e => { const file = e.target.files?.[0]; if (!file) return; e.target.value = ''; await handleSrtUpload(pid, file) }} />
                                                </label>
                                                {/* Edit Subtitles — appears as soon as subtitles exist (server ready OR any lang translated) */}
                                                {(serverJobStatus[pid] === 'ready' || count > 0 || translateStatus[pid] === 'complete' || translateStatus[pid] === 'partial') && (
                                                    <button type="button"
                                                        onClick={() => openSubtitleEditor(pid, filmUrl)}
                                                        className="btn btn-sm"
                                                        style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8' }}
                                                    >
                                                        ✏️ Edit Subtitles
                                                    </button>
                                                )}
                                                {/* Translate — gated on approval */}
                                                {(() => {
                                                    const approval = subtitleApproval[pid] || translateStatus[pid]
                                                    const isApproved = approval === 'approved_source'
                                                    const hasSubtitles = (serverJobStatus[pid] === 'ready') || (count > 0)
                                                    if (!hasSubtitles) return null
                                                    return (
                                                        <button
                                                            type="button"
                                                            disabled={!isApproved || isRunning}
                                                            title={!isApproved ? 'Edit subtitles and click "Approve Source" before translating' : 'Translate to all languages'}
                                                            onClick={() => isApproved && handleGenerateSubtitles(pid, filmUrl)}
                                                            className="btn btn-sm"
                                                            style={{
                                                                fontSize: '0.72rem', fontWeight: 700,
                                                                background: isApproved ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)',
                                                                border: `1px solid ${isApproved ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                                                color: isApproved ? '#34d399' : 'var(--text-tertiary)',
                                                                cursor: (!isApproved || isRunning) ? 'not-allowed' : 'pointer',
                                                                opacity: (!isApproved || isRunning) ? 0.6 : 1,
                                                            }}
                                                        >
                                                            {isRunning ? '🌍 Translating…' : isApproved ? '🌍 Translate All' : '🔒 Approve first'}
                                                        </button>
                                                    )
                                                })()}
                                                {(translateStatus[pid] === 'complete' || translateStatus[pid] === 'partial' || count > 0) && (
                                                    <button type="button" onClick={() => openReview(pid, projects.find(p => p.id === pid)?.title || form.title)} className="btn btn-sm" style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)', color: 'var(--accent-gold)' }}>
                                                        🔍 Review Subtitles
                                                    </button>
                                                )}
                                            </div>
                                            {progress > 0 && progress < 100 && (
                                                <div style={{ marginBottom: 'var(--space-md)' }}>
                                                    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, var(--accent-gold), #e8c547)', width: `${progress}%`, transition: 'width 0.4s ease', boxShadow: '0 0 8px rgba(212,168,83,0.4)' }} />
                                                    </div>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                                        <span>{statusMsg}</span>
                                                        <span>{progress}%</span>
                                                    </div>
                                                </div>
                                            )}
                                            {(progress === 0 || progress >= 100) && statusMsg && (
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', padding: '6px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 'var(--space-md)' }}>
                                                    {statusMsg}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })()}

                                {/* ── Movie Rolls Assignment ── */}
                                <div
                                    id="roll-assignment-section"
                                    style={{
                                        borderTop: rollError ? 'none' : '1px solid var(--border-subtle)',
                                        paddingTop: rollError ? 0 : 'var(--space-md)',
                                        marginTop: rollError ? 'var(--space-md)' : undefined,
                                        padding: rollError ? '14px' : undefined,
                                        borderRadius: rollError ? '10px' : undefined,
                                        background: rollError ? 'rgba(239,68,68,0.04)' : undefined,
                                        border: rollError ? '1px solid rgba(239,68,68,0.4)' : undefined,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: rollError ? '#ef4444' : 'var(--accent-gold)', marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        🎞️ Movie Rolls
                                        {rollError && <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '1px 8px', borderRadius: '99px', border: '1px solid rgba(239,68,68,0.25)', textTransform: 'none' }}>⚠ required — pick at least one</span>}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: rollError ? '#ef4444' : 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>
                                        {rollError
                                            ? 'A project must belong to at least one roll before it can be saved.'
                                            : 'Select which rolls this project should appear in. You can choose multiple or all.'}
                                    </div>
                                    {rollsLoading ? (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', padding: '0.5rem 0' }}>Loading rolls…</div>
                                    ) : allRolls.length === 0 ? (
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '0.25rem 0' }}>
                                            No rolls yet — create rolls from the <strong>Movie Rolls</strong> page first.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {/* Select All / Clear */}
                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
                                                <button type="button"
                                                    onClick={() => setSelectedRollIds(allRolls.map(r => r.id))}
                                                    style={{
                                                        padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem',
                                                        fontWeight: 700, cursor: 'pointer',
                                                        background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.25)',
                                                        color: 'var(--accent-gold)',
                                                    }}
                                                >Select All</button>
                                                <button type="button"
                                                    onClick={() => setSelectedRollIds([])}
                                                    style={{
                                                        padding: '3px 10px', borderRadius: '6px', fontSize: '0.72rem',
                                                        fontWeight: 700, cursor: 'pointer',
                                                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                                                        color: 'var(--text-tertiary)',
                                                    }}
                                                >Clear All</button>
                                            </div>
                                            {allRolls.map(roll => {
                                                const isSelected = selectedRollIds.includes(roll.id)
                                                return (
                                                    <label key={roll.id}
                                                        onClick={() => setRollError(false)}
                                                        style={{
                                                        display: 'flex', alignItems: 'center', gap: '10px',
                                                        padding: '8px 12px', borderRadius: '9px', cursor: 'pointer',
                                                        background: isSelected ? 'rgba(212,168,83,0.08)' : 'rgba(255,255,255,0.025)',
                                                        border: `1px solid ${isSelected ? 'rgba(212,168,83,0.3)' : 'rgba(255,255,255,0.07)'}`,
                                                        transition: 'all 0.15s',
                                                    }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={e => {
                                                                if (e.target.checked) setSelectedRollIds(prev => [...prev, roll.id])
                                                                else setSelectedRollIds(prev => prev.filter(id => id !== roll.id))
                                                            }}
                                                            style={{ width: '16px', height: '16px', accentColor: 'var(--accent-gold)', flexShrink: 0 }}
                                                        />
                                                        <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{roll.icon}</span>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isSelected ? '#fff' : 'var(--text-secondary)' }}>
                                                                {roll.title}
                                                            </div>
                                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                                                                {roll.displayOn === 'both' ? 'Homepage + Works' : roll.displayOn === 'homepage' ? 'Homepage only' : 'Works only'}
                                                                {!roll.visible && <span style={{ color: 'rgba(239,68,68,0.7)', marginLeft: '6px' }}>· hidden</span>}
                                                            </div>
                                                        </div>
                                                        {isSelected && <span style={{ fontSize: '0.65rem', color: 'var(--accent-gold)', fontWeight: 700 }}>✓ Added</span>}
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {error && (
                                    <div style={{
                                        display: 'flex', alignItems: 'flex-start', gap: '8px',
                                        fontSize: '0.85rem', fontWeight: 600, padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-md)',
                                        color: 'var(--error)', background: 'rgba(239,68,68,0.1)',
                                    }}>
                                        <span style={{ flex: 1 }}>✗ {error}</span>
                                        <button
                                            type="button"
                                            onClick={() => setError('')}
                                            aria-label="Dismiss error"
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '1rem', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
                                        >✕</button>
                                    </div>
                                )}

                                <div style={{
                                    position: 'sticky', bottom: 0, background: 'var(--bg-secondary)',
                                    borderTop: '1px solid var(--border-subtle)',
                                    padding: 'var(--space-md) 0', display: 'flex', gap: 'var(--space-md)',
                                    justifyContent: 'flex-end', zIndex: 10,
                                }}>
                                    <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost">Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={saving}>
                                        {saving ? 'Saving...' : editingId ? '💾 Save Changes' : '🎬 Create Project'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </main>
            )}
            {/* ── Subtitle Review Modal ─────────────────────────────────── */}
            {/* ── Cast Management Modal ──────────────────────────────────── */}
            <style>{`
                @media (max-width: 540px) {
                    .cast-admin-form-grid { grid-template-columns: 1fr !important; }
                    .cast-admin-modal-inner { max-height: 100dvh !important; border-radius: 16px 16px 0 0 !important; }
                    .cast-admin-modal-wrap { align-items: flex-end !important; padding: 0 !important; }
                }
            `}</style>
            {castProjectId && (
                <div
                    className="cast-admin-modal-wrap"
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1150, padding: 'var(--space-lg)', backdropFilter: 'blur(8px)',
                    }}
                    onClick={e => { if (e.target === e.currentTarget) closeCastModal() }}
                >
                    <div className="cast-admin-modal-inner" style={{
                        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '700px',
                        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 32px 100px rgba(0,0,0,0.7)',
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: 'var(--space-lg) var(--space-xl)',
                            borderBottom: '1px solid var(--border-subtle)',
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '2px' }}>🎭 Cast & Crew</h2>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{castProjectTitle} · {castMembers.length} member{castMembers.length !== 1 ? 's' : ''}</p>
                            </div>
                            <button onClick={closeCastModal} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
                        </div>

                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {/* Existing members */}
                            {castLoading ? (
                                <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>⏳ Loading...</div>
                            ) : castMembers.length > 0 ? (
                                <div style={{ padding: 'var(--space-md) var(--space-xl)' }}>
                                    <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: 'var(--space-sm)' }}>Current Members</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {castMembers.map(m => (
                                            <div key={m.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '12px',
                                                padding: '10px 12px', borderRadius: '8px',
                                                background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                                            }}>
                                                {/* Mini portrait */}
                                                <div style={{
                                                    width: '40px', height: '52px', borderRadius: '6px', flexShrink: 0,
                                                    background: m.photoUrl
                                                        ? `url(${m.photoUrl}) center/cover`
                                                        : 'linear-gradient(135deg, #1a1a2e, #16213e)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '1.2rem', opacity: m.photoUrl ? 1 : 0.4,
                                                    userSelect: 'none',
                                                }}>
                                                    {!m.photoUrl && '🎭'}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {m.name}
                                                        {m.bioTranslations && (
                                                            <span title="Bio translated into all languages" style={{ marginLeft: '6px', fontSize: '0.6rem', color: '#4ade80', fontWeight: 800 }}>✓ 10 langs</span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--accent-gold)', fontWeight: 600 }}>{m.jobTitle}</div>
                                                    {m.character && <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>as {m.character}</div>}
                                                </div>
                                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                    {/* Translate bio & character */}
                                                    <button
                                                        onClick={() => handleTranslateCastMember(m)}
                                                        disabled={translatingId === m.id}
                                                        style={{
                                                            background: 'none', border: '1px solid rgba(212,168,83,0.3)',
                                                            borderRadius: '4px', color: 'var(--accent-gold)',
                                                            cursor: translatingId === m.id ? 'wait' : 'pointer',
                                                            fontSize: '0.65rem', padding: '3px 6px', flexShrink: 0,
                                                            opacity: translatingId !== null && translatingId !== m.id ? 0.4 : 1,
                                                        }}
                                                        title="Translate bio & character to all 10 languages"
                                                    >
                                                        {translatingId === m.id ? '⏳' : '🌐'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteCastMember(m.id)}
                                                        style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.9rem', padding: '4px', flexShrink: 0 }}
                                                        title="Remove member"
                                                    >✕</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: 'var(--space-lg) var(--space-xl)', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>No cast members yet. Add the first one below.</div>
                            )}

                            {/* Add member form */}
                            <form onSubmit={handleAddCastMember} style={{ padding: 'var(--space-md) var(--space-xl) var(--space-xl)' }}>
                                <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: 'var(--space-md)' }}>+ Add Member</div>
                                {castError && <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginBottom: 'var(--space-sm)' }}>{castError}</div>}

                                <div className="cast-admin-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Name *</label>
                                        <input
                                            className="form-input"
                                            placeholder="Emma Chen"
                                            value={castForm.name}
                                            onChange={e => setCastForm(f => ({ ...f, name: e.target.value }))}
                                            style={{ fontSize: '0.8rem', padding: '7px 10px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Job Title *</label>
                                        <select
                                            className="form-input"
                                            value={castForm.jobTitle}
                                            onChange={e => setCastForm(f => ({ ...f, jobTitle: e.target.value }))}
                                            style={{ fontSize: '0.8rem', padding: '7px 10px' }}
                                        >
                                            {['Actor', 'Actress', 'Director', 'Producer', 'Writer', 'Cinematographer', 'Editor', 'Composer', 'Other'].map(t => (
                                                <option key={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Character Name</label>
                                        <input
                                            className="form-input"
                                            placeholder="Maya Williams"
                                            value={castForm.character}
                                            onChange={e => setCastForm(f => ({ ...f, character: e.target.value }))}
                                            style={{ fontSize: '0.8rem', padding: '7px 10px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Photo URL</label>
                                        <input
                                            className="form-input"
                                            placeholder="https://..."
                                            value={castForm.photoUrl}
                                            onChange={e => setCastForm(f => ({ ...f, photoUrl: e.target.value }))}
                                            style={{ fontSize: '0.8rem', padding: '7px 10px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Instagram URL</label>
                                        <input
                                            className="form-input"
                                            placeholder="https://instagram.com/..."
                                            value={castForm.instagramUrl}
                                            onChange={e => setCastForm(f => ({ ...f, instagramUrl: e.target.value }))}
                                            style={{ fontSize: '0.8rem', padding: '7px 10px' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)', display: 'block', marginBottom: '4px' }}>Short Bio</label>
                                        <textarea
                                            className="form-input"
                                            placeholder="A brief background about this person..."
                                            value={castForm.bio}
                                            onChange={e => setCastForm(f => ({ ...f, bio: e.target.value }))}
                                            rows={2}
                                            style={{ fontSize: '0.8rem', padding: '7px 10px', resize: 'none' }}
                                        />
                                    </div>
                                </div>

                                <button type="submit" disabled={castSaving} className="btn btn-primary btn-sm" style={{ width: '100%' }}>
                                    {castSaving ? 'Adding...' : '+ Add to Cast'}
                                </button>
                            </form>
                        </div>

                        <div style={{ padding: 'var(--space-md) var(--space-xl)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button onClick={closeCastModal} className="btn btn-ghost btn-sm">Done</button>
                        </div>
                    </div>
                </div>
            )}

            {reviewProjectId && (
                <div
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1100, padding: 'var(--space-lg)', backdropFilter: 'blur(6px)',
                    }}
                    onClick={e => { if (e.target === e.currentTarget) closeReview() }}
                >
                    <div style={{
                        background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-xl)', width: '100%', maxWidth: '860px',
                        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
                    }}>
                        {/* Header */}
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: 'var(--space-lg) var(--space-xl)',
                            borderBottom: '1px solid var(--border-subtle)',
                        }}>
                            <div>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '2px' }}>
                                    🔍 Subtitle Review
                                </h2>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    {reviewProjectTitle}
                                    {reviewData && ` · ${reviewData.segments.length} segments`}
                                    {reviewData?.transcribedWith && ` · ${reviewData.transcribedWith}`}
                                </p>
                            </div>
                            <button
                                onClick={closeReview}
                                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: '1.2rem', cursor: 'pointer' }}
                            >✕</button>
                        </div>

                        {reviewLoading && (
                            <div style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                ⏳ Loading subtitle data...
                            </div>
                        )}

                        {!reviewLoading && !reviewData && (
                            <div style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                No subtitles found for this project. Generate them first using the CC button.
                            </div>
                        )}

                        {!reviewLoading && reviewData && (() => {
                            const allLangs = ['en', ...Object.keys(reviewData.translations)]
                            const previewSegs = reviewLang === 'en'
                                ? reviewData.segments
                                : (reviewData.translations[reviewLang] || [])
                            const flaggedIds = new Set(reviewData.qcIssues.map(q => q.segmentIndex))

                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                                    {/* ── Panel 1: Language Status Grid ── */}
                                    <LangStatusGrid
                                        translations={reviewData.translations}
                                        langStatus={reviewData.langStatus}
                                        sourceSegmentCount={reviewData.segments.length}
                                        retryingLang={retryingLang}
                                        onRetry={retryLang}
                                    />

                                    {/* ── Panel 2: QC Report ── */}
                                    {reviewData.qcIssues.length > 0 && (
                                        <div style={{ padding: 'var(--space-md) var(--space-xl)', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(245,158,11,0.04)' }}>
                                            <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#f59e0b', marginBottom: 'var(--space-sm)' }}>
                                                ⚠️ QC Issues — {reviewData.qcIssues.length} / {reviewData.segments.length} segments flagged
                                            </div>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {(Object.entries(
                                                    reviewData.qcIssues.reduce<Record<string, number>>((acc, q) => {
                                                        q.issues.forEach(i => { acc[i.type] = (acc[i.type] || 0) + 1 })
                                                        return acc
                                                    }, {})
                                                )).map(([type, count]) => (
                                                    <span key={type} style={{
                                                        padding: '2px 8px', borderRadius: '10px', fontSize: '0.68rem',
                                                        background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
                                                        border: '1px solid rgba(245,158,11,0.3)',
                                                    }}>
                                                        {count}× {type.replace(/-/g, ' ')}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Panel 3: Language Switcher + Subtitle Preview ── */}
                                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                                        {/* Lang list */}
                                        <div style={{
                                            width: '140px', flexShrink: 0,
                                            borderRight: '1px solid var(--border-subtle)',
                                            overflowY: 'auto', padding: 'var(--space-sm)',
                                        }}>
                                            <div style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', padding: '4px 8px', marginBottom: '2px' }}>
                                                Preview
                                            </div>
                                            {allLangs.map(lang => (
                                                <button
                                                    key={lang}
                                                    onClick={() => setReviewLang(lang)}
                                                    style={{
                                                        display: 'block', width: '100%', textAlign: 'left',
                                                        padding: '6px 8px', borderRadius: '6px', border: 'none',
                                                        background: reviewLang === lang ? 'var(--accent-gold-glow, rgba(212,168,83,0.15))' : 'transparent',
                                                        color: reviewLang === lang ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                                        fontSize: '0.75rem', cursor: 'pointer',
                                                        borderLeft: reviewLang === lang ? '2px solid var(--accent-gold)' : '2px solid transparent',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    {LANGUAGE_NAMES[lang] || lang}
                                                    {lang === 'en' && <span style={{ fontSize: '0.6rem', opacity: 0.5, marginLeft: '4px' }}>src</span>}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Segment list */}
                                        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-sm) var(--space-md)' }}>
                                            {previewSegs.length === 0 ? (
                                                <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                                                    No segments for {LANGUAGE_NAMES[reviewLang] || reviewLang}
                                                </div>
                                            ) : (
                                                previewSegs.map((seg, i) => {
                                                    const isFlagged = reviewLang === 'en' && flaggedIds.has(i)
                                                    const flaggedSeg = isFlagged ? reviewData.qcIssues.find(q => q.segmentIndex === i) : null
                                                    return (
                                                        <div key={i} style={{
                                                            display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start',
                                                            padding: '6px 8px', borderRadius: '6px', marginBottom: '2px',
                                                            background: isFlagged ? 'rgba(245,158,11,0.07)' : 'transparent',
                                                            border: isFlagged ? '1px solid rgba(245,158,11,0.2)' : '1px solid transparent',
                                                        }}>
                                                            <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', fontFamily: 'monospace', minWidth: '52px', paddingTop: '2px' }}>
                                                                {`${Math.floor(seg.start / 60)}:${String(Math.floor(seg.start % 60)).padStart(2, '0')}`}
                                                            </span>
                                                            <div style={{ flex: 1 }}>
                                                                <span style={{ fontSize: '0.8rem', color: isFlagged ? '#f59e0b' : 'var(--text-primary)', lineHeight: 1.5 }}>
                                                                    {seg.text}
                                                                </span>
                                                                {flaggedSeg && (
                                                                    <div style={{ marginTop: '2px' }}>
                                                                        {flaggedSeg.issues.map((iss, j) => (
                                                                            <span key={j} style={{
                                                                                fontSize: '0.6rem', padding: '1px 6px',
                                                                                borderRadius: '8px', marginRight: '4px',
                                                                                background: 'rgba(245,158,11,0.15)',
                                                                                color: '#f59e0b',
                                                                            }}>
                                                                                {iss.type}: {iss.detail}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div style={{
                                        padding: 'var(--space-md) var(--space-xl)',
                                        borderTop: '1px solid var(--border-subtle)',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                            {reviewData.translateStatus === 'complete' ? '✅ All languages complete' : '⚠️ Translation partially complete'}
                                            {reviewData.generatedWith && ` · AI: ${reviewData.generatedWith}`}
                                        </span>
                                        <button onClick={closeReview} className="btn btn-ghost btn-sm">Close</button>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>
            )}

            {/* ── Publish Confirmation Gate (SRP: rendered by PublishGateModal component) ── */}
            <PublishGateModal
                isOpen={showPublishWarning && !!editingId}
                translatedCount={editingId ? (translationCount[editingId] ?? 0) : 0}
                saving={saving}
                onCancel={() => {
                    // Close the warning — keep the modal open so admin
                    // can use the CC button inside the modal to complete translations.
                    setShowPublishWarning(false)
                    // (modal stays open)
                }}
                onConfirm={handlePublishOverride}
            />

            {/* ── Subtitle Editor modal ── */}
            {editorProjectId && (
                <SubtitleEditor
                    projectId={editorProjectId}
                    episodeId={null}
                    initialSegments={editorSegments}
                    currentStatus={editorStatus}
                    filmUrl={editorFilmUrl}
                    initialPlacement={editorInitialPlacement}
                    initialMobilePlacement={editorInitialMobilePlacement}
                    initialLandscapePlacement={editorInitialLandscapePlacement}
                    useSeparateMobilePlacement={editorUseSeparateMobile}
                    onClose={() => setEditorProjectId(null)}
                    onSaved={(newStatus) => {
                        // Update the approval lookup so the translate gate re-renders
                        setSubtitleApproval(prev => ({ ...prev, [editorProjectId]: newStatus }))
                    }}
                />
            )}
        </div>
    )
}

