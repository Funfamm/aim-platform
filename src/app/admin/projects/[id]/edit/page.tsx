'use client'
// Force rebuild 1

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

import AdminSidebar from '@/components/AdminSidebar'
import SubtitleProgressBar from '@/components/admin/SubtitleProgressBar'
import SubtitleEditor, { type SubtitleCue } from '@/components/admin/SubtitleEditor'
import FileUploader from '@/components/FileUploader'
import { TOTAL_SUBTITLE_LANGS, SUBTITLE_TARGET_LANGS, LANGUAGE_NAMES, requiresTranslationGate, isBlockedStreamingUrl } from '@/config/subtitles'
import PublishGateModal from '@/components/admin/PublishGateModal'
import { transcribeVideo } from '@/lib/transcribe-client'
import { runQC, formatQCSummary } from '@/lib/subtitle-qc'
import { uploadSubtitleFile } from '@/lib/subtitle-file-parser'
import { readSSEStream } from '@/lib/sse-reader'

/* ── Types ── */
type FormData = {
    title: string; slug: string; tagline: string; description: string
    status: string; genre: string; year: string; duration: string
    featured: boolean; published: boolean; coverImage: string
    trailerUrl: string; filmUrl: string; projectType: string
    gallery: string; credits: string; sponsorData: string
}

const EMPTY_FORM: FormData = {
    title: '', slug: '', tagline: '', description: '',
    status: 'upcoming', genre: '', year: '', duration: '',
    featured: false, published: false, coverImage: '',
    trailerUrl: '', filmUrl: '', projectType: 'movie',
    gallery: '', credits: '', sponsorData: '',
}

const STATUSES = ['upcoming', 'in-production', 'completed']
const GENRES = ['Action','Adventure','Animation','Biography','Comedy','Crime','Documentary','Drama','Fantasy','Historical','Horror','Musical','Mystery','Romance','Sci-Fi','Short Film','Thriller','War','Western']

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

type RollOption = { id: string; title: string; icon: string; displayOn: string; visible: boolean }

export default function ProjectEditPage() {
    const router = useRouter()
    const params = useParams()
    const projectId = params.id as string
    const isNew = projectId === 'new'

    const [form, setForm] = useState<FormData>(EMPTY_FORM)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(!isNew)
    const [originalTitle, setOriginalTitle] = useState('')

    // Rolls
    const [allRolls, setAllRolls] = useState<RollOption[]>([])
    const [selectedRollIds, setSelectedRollIds] = useState<string[]>([])
    const [rollsLoading, setRollsLoading] = useState(false)
    const [rollError, setRollError] = useState(false)

    // ── Subtitle state (per-tab keyed: same pattern as projects list page) ──
    /** Composite state key: ensures subtitle state is always scoped */
    const sk = (mt: string) => `${projectId}:${mt}`
    /** Episode-aware state key */
    const esk = (mediaType: string, episodeId?: string | null) =>
        episodeId ? sk(`ep:${episodeId}`) : sk(mediaType)
    /** Parse tab key into mediaType + episodeId */
    const parseSubTab = (tab: string): { mediaType: string; episodeId: string | null } => {
        if (tab.startsWith('ep:')) return { mediaType: 'episode', episodeId: tab.slice(3) }
        return { mediaType: tab, episodeId: null }
    }

    const [subtitleTab, setSubtitleTab] = useState('movie')
    const [subtitleStatus, setSubtitleStatus] = useState<Record<string, string>>({})
    const [subtitleProgress, setSubtitleProgress] = useState<Record<string, number>>({})
    const [subtitlePhase, setSubtitlePhase] = useState<Record<string, 'transcribing' | 'translating' | 'done' | 'error' | null>>({})
    const [translationCount, setTranslationCount] = useState<Record<string, number>>({})
    const [translateStatus, setTranslateStatus] = useState<Record<string, string>>({})
    const [subtitleApproval, setSubtitleApproval] = useState<Record<string, string>>({})
    // Server-side subtitle job state (faster-whisper worker)
    type ServerJobStatus = 'idle' | 'queued' | 'processing' | 'ready' | 'failed'
    const [serverJobId, setServerJobId] = useState<Record<string, string | null>>({})
    const [serverJobStatus, setServerJobStatus] = useState<Record<string, ServerJobStatus>>({})
    const [serverJobMsg, setServerJobMsg] = useState<Record<string, string>>({})

    const [saveSuccess, setSaveSuccess] = useState(false)
    const [subGenerating, setSubGenerating] = useState(false)

    // ── Subtitle Editor modal ──
    const [editorProjectId, setEditorProjectId] = useState<string | null>(null)
    const [editorEpisodeId, setEditorEpisodeId] = useState<string | null>(null)
    const [editorSegments, setEditorSegments] = useState<SubtitleCue[]>([])
    const [editorFilmUrl, setEditorFilmUrl] = useState<string | null>(null)
    const [editorStatus, setEditorStatus] = useState('pending')
    const [editorMediaType, setEditorMediaType] = useState<string>('movie')
    const [editorInitialPlacement, setEditorInitialPlacement] = useState<any>(null)
    const [editorInitialMobilePlacement, setEditorInitialMobilePlacement] = useState<any>(null)
    const [editorInitialLandscapePlacement, setEditorInitialLandscapePlacement] = useState<any>(null)
    const [editorUseSeparateMobile, setEditorUseSeparateMobile] = useState(false)

    // Publish gate

    const [showPublishWarning, setShowPublishWarning] = useState(false)

    // Episodes
    type EpisodeRow = {
        id?: string; title: string; number: number; season: number
        videoUrl: string; duration: string; description: string
        thumbnail: string; published: boolean; _dirty?: boolean; _new?: boolean
    }
    const [episodes, setEpisodes] = useState<EpisodeRow[]>([])
    const [episodeSaving, setEpisodeSaving] = useState<string | null>(null)

    // Section collapse state
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        basic: true, status: true, media: true, episodes: false, sponsor: false,
        gallery: false, subtitles: false, rolls: false,
    })

    const toggleSection = (key: string) => setOpenSections(s => ({ ...s, [key]: !s[key] }))

    // Load project data
    useEffect(() => {
        if (isNew) {
            setRollsLoading(true)
            fetch('/api/admin/movie-rolls').then(r => r.ok ? r.json() : []).then(setAllRolls).catch(() => {}).finally(() => setRollsLoading(false))
            return
        }
        setLoading(true)
        Promise.all([
            fetch('/api/admin/projects').then(r => { if (r.status === 401) { window.location.href = '/admin/login'; return [] } return r.json() }),
            fetch('/api/admin/movie-rolls').then(r => r.ok ? r.json() : []),
            fetch(`/api/admin/projects/${projectId}/rolls`).then(r => r.ok ? r.json() : []),
            fetch(`/api/admin/subtitles?projectId=${projectId}`).then(r => r.ok ? r.json() : {}).catch(() => ({})),
        ]).then(([projects, rolls, assignedIds, subData]) => {
            const p = (projects as any[]).find((x: any) => x.id === projectId)
            if (!p) { router.push('/admin/projects'); return }
            setForm({
                title: p.title, slug: p.slug, tagline: p.tagline || '',
                description: p.description, status: p.status,
                genre: p.genre || '', year: p.year || '', duration: p.duration || '',
                featured: p.featured, published: p.published ?? false,
                coverImage: p.coverImage || '', trailerUrl: p.trailerUrl || '',
                filmUrl: p.filmUrl || '', projectType: p.projectType || 'movie',
                gallery: p.gallery || '', credits: p.credits || '',
                sponsorData: p.sponsorData || '',
            })
            setOriginalTitle(p.title)
            setAllRolls(rolls)
            setSelectedRollIds(assignedIds)
            const sd = subData as Record<string, any>
            if (sd?.subtitle?.status) setSubtitleApproval(prev => ({ ...prev, [sk('movie')]: sd.subtitle.status }))
            // Check subtitle count for movie + trailer
            const checkSubtitle = (mediaType: string, episodeId?: string) => {
                const key = episodeId ? sk(`ep:${episodeId}`) : sk(mediaType)
                const qs = episodeId ? `lang=en&mediaType=episode&episodeId=${episodeId}` : `lang=en&mediaType=${mediaType}`
                fetch(`/api/subtitles/${projectId}?${qs}`)
                    .then(r => r.json())
                    .then(sub => {
                        const count = sub.available?.length ?? 0
                        setTranslationCount(s => ({ ...s, [key]: count }))
                        setTranslateStatus(s => ({ ...s, [key]: sub.translateStatus ?? 'pending' }))
                        if (count > 0) {
                            setSubtitlePhase(s => ({ ...s, [key]: 'done' }))
                        }
                    })
                    .catch(() => {})
                // Load approval status + detect existing subtitle from admin API
                // (independent of public subtitlesPublic gate)
                const aqQs = episodeId ? `projectId=${projectId}&mediaType=episode&episodeId=${episodeId}` : `projectId=${projectId}&mediaType=${mediaType}`
                fetch(`/api/admin/subtitles?${aqQs}`)
                    .then(r => r.ok ? r.json() : {})
                    .then((res: { subtitle?: { status?: string; segments?: string; translations?: string; translateStatus?: string } }) => {
                        if (res.subtitle?.status) setSubtitleApproval(prev => ({ ...prev, [key]: res.subtitle!.status! }))
                        // If the admin API confirms a subtitle exists with segments,
                        // make sure the UI reflects that even if the public API is gated
                        if (res.subtitle?.segments) {
                            setSubtitlePhase(s => ({ ...s, [key]: s[key] || 'done' }))
                            // Count translations from the admin record
                            let adminCount = 1 // at least the source language
                            try {
                                const translations = res.subtitle.translations ? JSON.parse(res.subtitle.translations) : null
                                if (translations && typeof translations === 'object') {
                                    adminCount += Object.keys(translations).length
                                }
                            } catch { /* ignore parse errors */ }
                            setTranslationCount(s => ({ ...s, [key]: Math.max(s[key] ?? 0, adminCount) }))
                            if (res.subtitle.translateStatus) {
                                setTranslateStatus(s => ({ ...s, [key]: res.subtitle!.translateStatus! }))
                            }
                        }
                    })
                    .catch(() => {})
            }
            if (p.filmUrl) checkSubtitle('movie')
            if (p.trailerUrl) checkSubtitle('trailer')
            // Auto-select tab
            if (!p.filmUrl && p.trailerUrl) setSubtitleTab('trailer')
            // Load episodes for series and shorts
            if (p.projectType === 'series' || p.projectType === 'shorts') {
                fetch(`/api/admin/episodes?projectId=${projectId}`)
                    .then(r => r.ok ? r.json() : { episodes: [] })
                    .then((data: any) => {
                        const eps = Array.isArray(data) ? data : (data.episodes || [])
                        setEpisodes(eps.map((e: any) => ({
                            id: e.id, title: e.title, number: e.number, season: e.season,
                            videoUrl: e.videoUrl || '', duration: e.duration || '',
                            description: e.description || '', thumbnail: e.thumbnail || '',
                            published: e.published ?? false,
                        })))
                        // Check subtitle status for each episode with video
                        eps.forEach((e: any) => { if (e.id && e.videoUrl) checkSubtitle('episode', e.id) })
                        // Auto-select first episode tab if no movie/trailer
                        if (!p.filmUrl && !p.trailerUrl && eps.length > 0 && eps[0].id) {
                            setSubtitleTab(`ep:${eps[0].id}`)
                        }
                    })
                    .catch(() => {})
            }
        }).catch(() => setError('Failed to load project')).finally(() => setLoading(false))
    }, [projectId, isNew, router])

    const updateField = (field: keyof FormData, value: string | boolean) =>
        setForm(f => ({ ...f, [field]: value }))

    const doSave = async (override = false) => {
        if (!form.title || !form.description) { setError('Please fill in title and description'); return }
        const needsGate = (form.published || requiresTranslationGate(form.status, form.filmUrl)) && !!form.filmUrl
        if (!override && needsGate && !isNew) {
            // Re-fetch the latest subtitle count right before the gate — avoids stale state
            // if subtitles were generated after the page was first loaded.
            const movieKey = sk('movie')
            let freshCount = translationCount[movieKey] ?? 0
            try {
                const subRes = await fetch(`/api/subtitles/${projectId}?lang=en`)
                if (subRes.ok) {
                    const subJson = await subRes.json()
                    // Filter to target langs only — `available` also contains the source language
                    const allAvail: string[] = subJson.available ?? []
                    freshCount = allAvail.filter((l: string) => (SUBTITLE_TARGET_LANGS as readonly string[]).includes(l)).length
                    setTranslationCount(s => ({ ...s, [movieKey]: freshCount }))
                }
            } catch { /* fall through with cached count */ }
            if (freshCount < TOTAL_SUBTITLE_LANGS) { setShowPublishWarning(true); return }
        }
        if (allRolls.length > 0 && selectedRollIds.length === 0) {
            setError('🎬 This project must be assigned to at least one Movie Roll before saving.')
            setRollError(true); return
        }
        setSaving(true); setError(''); setRollError(false)
        try {
            const payload = { ...form, slug: form.slug || slugify(form.title) }
            const url = isNew ? '/api/admin/projects' : `/api/admin/projects/${projectId}`
            const method = isNew ? 'POST' : 'PUT'
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            if (!res.ok) { const data = await res.json(); throw new Error(data.error || 'Failed to save') }
            const saved = await res.json()
            // Save roll assignments
            fetch(`/api/admin/projects/${saved.id}/rolls`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rollIds: selectedRollIds }),
            }).catch(() => {})
            // Stay on editor — show success banner
            setSaveSuccess(true)
            setTimeout(() => setSaveSuccess(false), 3000)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save')
        } finally { setSaving(false) }
    }

    const handleSave = async (e: React.FormEvent) => { e.preventDefault(); await doSave(false) }

    // ── Episode helpers ──
    const updateEpisode = (idx: number, field: string, value: string | number | boolean) => {
        setEpisodes(prev => prev.map((ep, i) => i === idx ? { ...ep, [field]: value, _dirty: true } : ep))
    }

    const addEpisode = () => {
        const maxNum = episodes.filter(e => e.season === 1).reduce((max, e) => Math.max(max, e.number), 0)
        setEpisodes(prev => [...prev, {
            title: '', number: maxNum + 1, season: 1,
            videoUrl: '', duration: '', description: '',
            thumbnail: '', published: false, _new: true, _dirty: true,
        }])
    }

    const saveEpisode = async (idx: number) => {
        if (isNew) { setError('Save the project first, then add episodes'); return }
        const ep = episodes[idx]
        if (!ep.title) { setError('Episode title is required'); return }
        const key = ep.id || `new-${idx}`
        setEpisodeSaving(key)
        try {
            const payload = {
                projectId: projectId,
                title: ep.title, number: ep.number, season: ep.season,
                videoUrl: ep.videoUrl || null, duration: ep.duration || null,
                description: ep.description || null, thumbnail: ep.thumbnail || null,
                published: ep.published,
            }
            const isCreate = !ep.id
            const res = await fetch('/api/admin/episodes', {
                method: isCreate ? 'POST' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isCreate ? payload : { id: ep.id, ...payload }),
            })
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed') }
            const data = await res.json()
            const saved = data.episode || data
            setEpisodes(prev => prev.map((e, i) => i === idx ? {
                ...e, id: saved.id, _new: false, _dirty: false,
            } : e))
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save episode')
        } finally { setEpisodeSaving(null) }
    }

    const deleteEpisode = async (idx: number) => {
        const ep = episodes[idx]
        if (ep._new) { setEpisodes(prev => prev.filter((_, i) => i !== idx)); return }
        if (!confirm(`Delete episode S${ep.season}E${ep.number} "${ep.title}"?`)) return
        try {
            const res = await fetch(`/api/admin/episodes?id=${ep.id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete')
            setEpisodes(prev => prev.filter((_, i) => i !== idx))
        } catch { setError('Failed to delete episode') }
    }

    // ── Unified subtitle handlers (matches projects list page pattern) ──

    /** Poll the server job status every 5s until terminal state */
    const pollServerJob = (jobId: string, mediaType: string = 'movie', episodeId?: string | null) => {
        const key = esk(mediaType, episodeId)
        let attempts = 0
        const iv = setInterval(async () => {
            attempts++
            if (attempts > 120) {
                clearInterval(iv)
                setServerJobStatus(s => ({ ...s, [key]: 'failed' }))
                setServerJobMsg(s => ({ ...s, [key]: '⏱ Polling timed out (10 min). Check worker logs.' }))
                return
            }
            try {
                const r = await fetch(`/api/subtitles/status/${jobId}`)
                if (!r.ok) return
                const d = await r.json()
                setServerJobStatus(s => ({ ...s, [key]: d.status }))
                if (d.status === 'ready') {
                    clearInterval(iv)
                    setServerJobMsg(s => ({ ...s, [key]: '✅ Subtitles ready! You can now run translation.' }))
                    const epQs = episodeId ? `&episodeId=${episodeId}` : ''
                    fetch(`/api/subtitles/${projectId}?lang=en&mediaType=${mediaType}${epQs}`).then(r2 => r2.json()).then(sub => {
                        setTranslationCount(s => ({ ...s, [key]: sub.available?.length ?? 0 }))
                        setTranslateStatus(s => ({ ...s, [key]: sub.translateStatus ?? 'pending' }))
                    }).catch(() => {})
                } else if (d.status === 'failed') {
                    clearInterval(iv)
                    setServerJobMsg(s => ({ ...s, [key]: `❌ Worker failed: ${d.errorMessage || 'unknown'}` }))
                } else if (d.status === 'processing') {
                    setServerJobMsg(s => ({ ...s, [key]: '🔄 Worker is transcribing… (may take several minutes)' }))
                }
            } catch { /* ignore transient errors */ }
        }, 5000)
    }

    /** Manually trigger server-side subtitle generation */
    const handleServerGenerate = async (filmUrl: string, mediaType: string = 'movie', episodeId?: string | null) => {
        const key = esk(mediaType, episodeId)
        const cur = serverJobStatus[key]
        if (cur === 'queued' || cur === 'processing') return
        setServerJobStatus(s => ({ ...s, [key]: 'queued' }))
        setServerJobMsg(s => ({ ...s, [key]: '⚡ Sending to worker…' }))
        try {
            const r = await fetch('/api/subtitles/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, videoUrl: filmUrl, mediaType, ...(episodeId ? { episodeId } : {}) }),
            })
            const d = await r.json().catch(() => ({}))
            if (r.ok && d.jobId) {
                setServerJobId(s => ({ ...s, [key]: d.jobId }))
                setServerJobMsg(s => ({ ...s, [key]: '🤖 Job queued — worker is processing in background.' }))
                pollServerJob(d.jobId, mediaType, episodeId)
            } else if (r.status === 409) {
                // Auto-clear stuck job and retry
                setServerJobMsg(s => ({ ...s, [key]: '♻️ Clearing stuck job and retrying…' }))
                await fetch('/api/admin/subtitle-jobs/clear-stuck', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId, ...(episodeId ? { episodeId } : {}) }),
                })
                const retry = await fetch('/api/subtitles/generate', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId, videoUrl: filmUrl, mediaType, ...(episodeId ? { episodeId } : {}) }),
                })
                const rd = await retry.json().catch(() => ({}))
                if (retry.ok && rd.jobId) {
                    setServerJobId(s => ({ ...s, [key]: rd.jobId }))
                    setServerJobMsg(s => ({ ...s, [key]: '🤖 Job queued — worker is transcribing in the background.' }))
                    pollServerJob(rd.jobId, mediaType, episodeId)
                } else {
                    setServerJobStatus(s => ({ ...s, [key]: 'failed' }))
                    setServerJobMsg(s => ({ ...s, [key]: '⚠️ Could not restart subtitle job. Try again.' }))
                }
            } else {
                setServerJobStatus(s => ({ ...s, [key]: 'failed' }))
                setServerJobMsg(s => ({ ...s, [key]: `⚠️ ${d.error || "Worker not reachable. Is it running?"}` }))
            }
        } catch {
            setServerJobStatus(s => ({ ...s, [key]: 'failed' }))
            setServerJobMsg(s => ({ ...s, [key]: '⚠️ Network error reaching worker.' }))
        }
    }

    /** Handle manual SRT/VTT transcript upload */
    const handleSrtUpload = async (file: File, mediaType: string = 'movie', episodeId?: string | null) => {
        const key = esk(mediaType, episodeId)
        await uploadSubtitleFile(projectId, file, {
            onPhase:    (phase) => setSubtitlePhase(s    => ({ ...s, [key]: phase })),
            onStatus:   (msg)   => setSubtitleStatus(s   => ({ ...s, [key]: msg })),
            onProgress: (pct)   => setSubtitleProgress(s => ({ ...s, [key]: pct })),
            onCountReady: () => {
                setTranslationCount(s => ({ ...s, [key]: 1 }))
                setTranslateStatus(s  => ({ ...s, [key]: 'pending' }))
            },
            onError: setError,
        }, mediaType, episodeId)
    }

    /** Generate or resume multi-language subtitles (browser fallback + translate) */
    const handleGenerateSubtitles = async (filmUrl: string, mediaType: string = 'movie', episodeId?: string | null) => {
        const key = esk(mediaType, episodeId)
        const isRunning = subtitlePhase[key] === 'transcribing' || subtitlePhase[key] === 'translating'
        if (isRunning) return

        setError('')
        setSubtitleStatus(s => ({ ...s, [key]: '' }))
        setSubtitlePhase(s => ({ ...s, [key]: null }))
        setSubtitleProgress(s => ({ ...s, [key]: 0 }))

        const isResume = translateStatus[key] === 'partial'
        const hasWorkerTranscript = serverJobStatus[key] === 'ready'
        const hasExistingTranscript = (translationCount[key] ?? 0) > 0

        let hasDbTranscript = hasExistingTranscript || hasWorkerTranscript
        if (!hasDbTranscript && !isResume) {
            try {
                const epQs = episodeId ? `&episodeId=${episodeId}` : ''
                const chk = await fetch(`/api/admin/subtitles?projectId=${projectId}&mediaType=${mediaType}${epQs}`)
                const { subtitle } = await chk.json()
                if (subtitle?.segments) hasDbTranscript = true
            } catch { /* ignore — fall through to browser path */ }
        }

        if (!isResume && !hasDbTranscript) {
            const { hostname: filmHost } = isBlockedStreamingUrl(filmUrl)
            if (filmHost) {
                setSubtitleStatus(s => ({ ...s, [key]: `⏳ Routing via server proxy for ${filmHost}...` }))
            }
            setSubtitlePhase(s => ({ ...s, [key]: 'transcribing' }))
            setSubtitleStatus(s => ({ ...s, [key]: '⏳ Loading audio engine...' }))
            setSubtitleProgress(s => ({ ...s, [key]: 2 }))
            try {
                const result = await transcribeVideo(filmUrl, (status, detail) => {
                    setSubtitleStatus(s => ({ ...s, [key]: `⏳ ${detail || status}` }))
                    const phaseProgress: Record<string, number> = {
                        'loading-ffmpeg': 5, 'extracting-audio': 15,
                        'loading-model': 25, 'transcribing': 42,
                    }
                    setSubtitleProgress(s => ({ ...s, [key]: phaseProgress[status] || s[key] || 0 }))
                })
                const qcSummary = runQC(result.segments)
                setSubtitleStatus(s => ({ ...s, [key]: '💾 Saving transcript...' }))
                setSubtitleProgress(s => ({ ...s, [key]: 48 }))
                await fetch('/api/admin/subtitles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId, language: 'en', segments: result.segments,
                        transcribedWith: 'whisper-medium', qcIssues: qcSummary.results, status: 'pending',
                        mediaType, ...(episodeId ? { episodeId } : {}),
                    }),
                })
                setSubtitleProgress(s => ({ ...s, [key]: 50 }))
                setSubtitleStatus(s => ({ ...s, [key]: `✅ Transcript saved — ${formatQCSummary(qcSummary)}` }))
                setError('')
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'error'
                setSubtitleStatus(s => ({ ...s, [key]: `❌ Transcription failed: ${msg}` }))
                setError(`Transcription failed: ${msg}`)
                setSubtitlePhase(s => ({ ...s, [key]: 'error' }))
                setSubtitleProgress(s => ({ ...s, [key]: 0 }))
                return
            }
        } else {
            setSubtitleProgress(s => ({ ...s, [key]: 50 }))
        }

        setSubtitlePhase(s => ({ ...s, [key]: 'translating' }))
        setSubtitleStatus(s => ({ ...s, [key]: '🌍 Starting server translation...' }))
        try {
            const res = await fetch('/api/admin/subtitles/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, mediaType, ...(episodeId ? { episodeId } : {}) }),
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
                    setSubtitleStatus(s => ({ ...s, [key]: `🌍 Translating ${data.langName}...` }))
                    setSubtitleProgress(s => ({ ...s, [key]: 50 + Math.round((data.pct ?? 0) * 0.48) }))
                } else if (data.phase === 'done') {
                    completed++
                    setTranslationCount(s => ({ ...s, [key]: completed + 1 }))
                } else if (data.phase === 'complete') {
                    const allDone = data.allDone ?? false
                    setSubtitleProgress(s => ({ ...s, [key]: 100 }))
                    setSubtitleStatus(s => ({ ...s, [key]: allDone ? `✓ All ${TOTAL_SUBTITLE_LANGS} languages ready` : `✓ ${completed + 1} languages ready` }))
                    setSubtitlePhase(s => ({ ...s, [key]: 'done' }))
                    setTranslateStatus(s => ({ ...s, [key]: allDone ? 'complete' : 'partial' }))
                    setTranslationCount(s => ({ ...s, [key]: allDone ? TOTAL_SUBTITLE_LANGS : completed + 1 }))
                } else if (data.phase === 'error' && data.lang) {
                    setSubtitleStatus(s => ({ ...s, [key]: `⚠️ ${data.lang} failed — continuing...` }))
                }
            })
        } catch (err) {
            setSubtitleStatus(s => ({ ...s, [key]: `❌ Translation error: ${err instanceof Error ? err.message : 'error'}` }))
            setSubtitlePhase(s => ({ ...s, [key]: 'error' }))
            setTranslateStatus(s => ({ ...s, [key]: 'partial' }))
        }
    }

    /** Open the subtitle editor modal — same as projects list page */
    const openSubtitleEditor = async (filmUrl: string | null, mediaType: string = 'movie', episodeId?: string | null) => {
        try {
            const epQs = episodeId ? `&episodeId=${episodeId}` : ''
            const res = await fetch(`/api/admin/subtitles?projectId=${projectId}&mediaType=${mediaType}${epQs}`)
            const { subtitle } = await res.json()
            if (!subtitle) { alert('No subtitles found. Generate them first.'); return }
            const segs: SubtitleCue[] = JSON.parse(subtitle.segments || '[]')
            setEditorInitialPlacement({
                verticalAnchor: subtitle.verticalAnchor ?? 'bottom',
                horizontalAlign: subtitle.horizontalAlign ?? 'center',
                offsetYPercent: subtitle.offsetYPercent ?? 0,
                offsetXPercent: subtitle.offsetXPercent ?? 0,
                safeAreaMarginPx: subtitle.safeAreaMarginPx ?? 12,
                backgroundStyle: subtitle.backgroundStyle ?? 'shadow',
                fontScale: subtitle.fontScale ?? 1.0,
                cueOverrides: subtitle.cueOverrides
                    ? (typeof subtitle.cueOverrides === 'string' ? JSON.parse(subtitle.cueOverrides) : subtitle.cueOverrides)
                    : {},
            })
            setEditorInitialMobilePlacement({
                verticalAnchor: subtitle.mobileVerticalAnchor ?? 'bottom',
                horizontalAlign: subtitle.mobileHorizontalAlign ?? 'center',
                offsetYPercent: subtitle.mobileOffsetYPercent ?? 0,
                offsetXPercent: subtitle.mobileOffsetXPercent ?? 0,
                safeAreaMarginPx: subtitle.mobileSafeAreaMarginPx ?? 20,
                fontScale: subtitle.mobileFontScale ?? 0.9,
            })
            setEditorInitialLandscapePlacement({
                verticalAnchor: subtitle.landscapeVerticalAnchor ?? 'bottom',
                horizontalAlign: subtitle.landscapeHorizontalAlign ?? 'center',
                offsetYPercent: subtitle.landscapeOffsetYPercent ?? 0,
                offsetXPercent: subtitle.landscapeOffsetXPercent ?? 0,
                safeAreaMarginPx: subtitle.landscapeSafeAreaMarginPx ?? 20,
                fontScale: subtitle.landscapeFontScale ?? 0.9,
            })
            setEditorUseSeparateMobile(subtitle.useSeparateMobilePlacement ?? false)
            setEditorSegments(segs)
            setEditorFilmUrl(filmUrl)
            setEditorStatus(subtitle.status || 'pending')
            setEditorProjectId(projectId)
            setEditorMediaType(mediaType)
            setEditorEpisodeId(episodeId ?? null)
        } catch {
            alert('Could not load subtitles. Try again.')
        }
    }

    const epLabelStyle: React.CSSProperties = {
        fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px', display: 'block',
    }

    if (loading) {
        return (
            <div className="admin-layout">
                <AdminSidebar />
                <main className="admin-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading project…</div>
                </main>
            </div>
        )
    }

    /* ── Section header component ── */
    const SectionHeader = ({ id, emoji, title }: { id: string; emoji: string; title: string }) => (
        <button
            type="button"
            onClick={() => toggleSection(id)}
            style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0',
                fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'left',
            }}
        >
            <span>{emoji}</span>
            <span style={{ flex: 1 }}>{title}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', transition: 'transform 0.2s', transform: openSections[id] ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
        </button>
    )

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main">
                {/* Header */}
                <div className="admin-header" style={{ marginBottom: 'var(--space-lg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                        <button onClick={() => router.push('/admin/projects')} className="btn btn-ghost btn-sm" style={{ padding: '4px 10px' }}>← Back</button>
                        <h1 className="admin-page-title" style={{ fontSize: '1.3rem', flex: 1 }}>
                            {isNew ? '🎬 New Project' : `✏️ ${originalTitle}`}
                        </h1>
                        {/* Preview as User — only for saved projects with video content */}
                        {!isNew && form.slug && (form.filmUrl || episodes.some(e => e.videoUrl)) && (
                            <a
                                href={`/${params?.locale || 'en'}/works/${form.slug}/watch`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-ghost btn-sm"
                                style={{ fontSize: '0.78rem', border: '1px solid rgba(212,168,83,0.3)', color: 'var(--accent-gold)' }}
                            >
                                👁 Preview as User
                            </a>
                        )}
                    </div>
                </div>

                <form onSubmit={handleSave} style={{ maxWidth: '720px' }}>
                    {/* ══ BASIC INFO ══ */}
                    <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                        <SectionHeader id="basic" emoji="📝" title="Basic Information" />
                        {openSections.basic && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingTop: 'var(--space-sm)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                    <div>
                                        <label className="form-label">Title *</label>
                                        <input className="form-input" value={form.title}
                                            onChange={e => { updateField('title', e.target.value); if (isNew) updateField('slug', slugify(e.target.value)) }}
                                            placeholder="e.g. Neon Saints" required />
                                    </div>
                                    <div>
                                        <label className="form-label">Slug</label>
                                        <input className="form-input" value={form.slug}
                                            onChange={e => updateField('slug', e.target.value)}
                                            placeholder="auto-generated" style={{ color: 'var(--text-tertiary)' }} />
                                    </div>
                                </div>
                                <div>
                                    <label className="form-label">Tagline</label>
                                    <input className="form-input" value={form.tagline}
                                        onChange={e => updateField('tagline', e.target.value)}
                                        placeholder="A short hook for the project..." />
                                </div>
                                <div>
                                    <label className="form-label">Description *</label>
                                    <textarea className="form-input" rows={4} value={form.description}
                                        onChange={e => updateField('description', e.target.value)}
                                        placeholder="Full synopsis or description..." required />
                                </div>
                                {/* Genre pills */}
                                <div>
                                    <label className="form-label">Genre</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {GENRES.map(g => {
                                            const selected = form.genre?.split(',').map(x => x.trim()).includes(g)
                                            return (
                                                <button key={g} type="button"
                                                    onClick={() => {
                                                        const current = form.genre ? form.genre.split(',').map(x => x.trim()).filter(Boolean) : []
                                                        const next = selected ? current.filter(x => x !== g) : [...current, g]
                                                        updateField('genre', next.join(', '))
                                                    }}
                                                    style={{
                                                        fontSize: '0.65rem', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', cursor: 'pointer',
                                                        border: selected ? '1px solid rgba(212,168,83,0.5)' : '1px solid rgba(255,255,255,0.1)',
                                                        background: selected ? 'rgba(212,168,83,0.15)' : 'rgba(255,255,255,0.04)',
                                                        color: selected ? 'var(--accent-gold)' : 'var(--text-tertiary)', transition: 'all 0.15s',
                                                    }}
                                                >{g}</button>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                    <div>
                                        <label className="form-label">Year</label>
                                        <input className="form-input" value={form.year} onChange={e => updateField('year', e.target.value)} placeholder="e.g. 2026" />
                                    </div>
                                    <div>
                                        <label className="form-label">Duration</label>
                                        <input className="form-input" value={form.duration} onChange={e => updateField('duration', e.target.value)} placeholder="e.g. 12 min" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ══ STATUS & VISIBILITY ══ */}
                    <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                        <SectionHeader id="status" emoji="🔒" title="Status & Visibility" />
                        {openSections.status && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingTop: 'var(--space-sm)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                                    <div>
                                        <label className="form-label">Status</label>
                                        <select className="form-input" value={form.status} onChange={e => updateField('status', e.target.value)}>
                                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Project Type</label>
                                        <select className="form-input" value={form.projectType} onChange={e => updateField('projectType', e.target.value)}>
                                            <option value="movie">Movie</option>
                                            <option value="series">Series</option>
                                            <option value="short">Short Film</option>
                                            <option value="shorts">Shorts (no trailer)</option>
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-xl)', paddingTop: 'var(--space-sm)' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input type="checkbox" checked={form.featured} onChange={e => updateField('featured', e.target.checked)} />
                                        ⭐ Featured
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input type="checkbox" checked={form.published} onChange={e => updateField('published', e.target.checked)} />
                                        🌐 Published
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ══ MEDIA ══ */}
                    <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                        <SectionHeader id="media" emoji="🎥" title="Media" />
                        {openSections.media && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingTop: 'var(--space-sm)' }}>
                                <div>
                                    <label className="form-label">Cover Image</label>
                                    <FileUploader
                                        category="projects" accept="image/*"
                                        currentUrl={form.coverImage}
                                        onUpload={(url) => updateField('coverImage', url)}
                                        label="Cover Image"
                                    />
                                </div>

                                {/* Trailer — hidden for Shorts since they don't use trailers */}
                                {form.projectType !== 'shorts' && (
                                    <div>
                                        <FileUploader
                                            category="trailers" accept="video/*,image/*"
                                            maxSizeMB={2000}
                                            currentUrl={form.trailerUrl}
                                            onUpload={(url) => updateField('trailerUrl', url)}
                                            label="Trailer (drag & drop or paste URL)"
                                        />
                                    </div>
                                )}

                                {/* Film URL — for movies and short films (not series/shorts which use episodes) */}
                                {(form.projectType === 'movie' || form.projectType === 'short') && (
                                    <div>
                                        <FileUploader
                                            category="films" accept="video/*,image/*"
                                            maxSizeMB={5000}
                                            currentUrl={form.filmUrl}
                                            onUpload={(url) => updateField('filmUrl', url)}
                                            label="Film / Main Video (drag & drop or paste URL)"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ══ SPONSOR ══ */}
                    <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                        <SectionHeader id="sponsor" emoji="🤝" title="Project Sponsor" />
                        {openSections.sponsor && (() => {
                            let sd: { name?: string; logoUrl?: string; description?: string } = {}
                            try { if (form.sponsorData) sd = JSON.parse(form.sponsorData) } catch { /* ignore */ }
                            const updateSponsor = (field: string, value: string) => {
                                const current = { ...sd, [field]: value }
                                if (!current.name && !current.logoUrl && !current.description) updateField('sponsorData', '')
                                else updateField('sponsorData', JSON.stringify(current))
                            }
                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingTop: 'var(--space-sm)' }}>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Sponsor info appears in publish emails.</p>
                                    <input className="form-input" placeholder="Sponsor Name" value={sd.name || ''} onChange={e => updateSponsor('name', e.target.value)} />
                                    <input className="form-input" placeholder="Logo URL" value={sd.logoUrl || ''} onChange={e => updateSponsor('logoUrl', e.target.value)} />
                                    <input className="form-input" placeholder="Short description" value={sd.description || ''} onChange={e => updateSponsor('description', e.target.value)} />
                                </div>
                            )
                        })()}
                    </div>

                    {/* ══ GALLERY & CREDITS ══ */}
                    <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                        <SectionHeader id="gallery" emoji="📸" title="Gallery & Credits" />
                        {openSections.gallery && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingTop: 'var(--space-sm)' }}>
                                <div>
                                    <label className="form-label" htmlFor="gallery">Gallery Media <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>(images &amp; videos — one URL per line)</span></label>
                                    <textarea className="form-input" rows={3} value={form.gallery} onChange={e => updateField('gallery', e.target.value)}
                                        placeholder={"https://cdn.example.com/still-1.jpg\nhttps://cdn.example.com/bts-clip.mp4\nhttps://cdn.example.com/still-2.jpg"}
                                        style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                                </div>
                                <div>
                                    <label className="form-label">Credits <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>(one per line: Role — Name)</span></label>
                                    <textarea className="form-input" rows={4} value={form.credits} onChange={e => updateField('credits', e.target.value)}
                                        placeholder={"Director — Jane Doe\nProducer — John Smith\nEditor — Alex Kim"}
                                        style={{ fontFamily: 'monospace', fontSize: '0.82rem' }} />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ══ EPISODES (series + shorts) ══ */}
                    {(form.projectType === 'series' || form.projectType === 'shorts') && (
                        <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                            <SectionHeader id="episodes" emoji="📺" title={`Episodes (${episodes.length})`} />
                            {openSections.episodes && (
                                <div style={{ paddingTop: 'var(--space-sm)' }}>
                                    {episodes.length === 0 && (
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>No episodes yet. Add the first one below.</p>
                                    )}

                                    {episodes.map((ep, idx) => (
                                        <div key={ep.id || `new-${idx}`} style={{
                                            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
                                            padding: 'var(--space-md)', marginBottom: 'var(--space-sm)',
                                            background: ep._new ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.02)',
                                        }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '60px 60px 1fr', gap: '8px', marginBottom: '8px' }}>
                                                <div>
                                                    <label style={epLabelStyle}>S#</label>
                                                    <input className="form-input" type="number" min={1} value={ep.season}
                                                        onChange={e => updateEpisode(idx, 'season', Number(e.target.value))}
                                                        style={{ fontSize: '0.82rem', padding: '6px 8px' }} />
                                                </div>
                                                <div>
                                                    <label style={epLabelStyle}>E#</label>
                                                    <input className="form-input" type="number" min={1} value={ep.number}
                                                        onChange={e => updateEpisode(idx, 'number', Number(e.target.value))}
                                                        style={{ fontSize: '0.82rem', padding: '6px 8px' }} />
                                                </div>
                                                <div>
                                                    <label style={epLabelStyle}>Title *</label>
                                                    <input className="form-input" value={ep.title}
                                                        onChange={e => updateEpisode(idx, 'title', e.target.value)}
                                                        placeholder="Episode title" style={{ fontSize: '0.82rem', padding: '6px 8px' }} />
                                                </div>
                                            </div>
                                            <div style={{ marginBottom: '8px' }}>
                                                <FileUploader
                                                    category="episodes" accept="video/*,image/*"
                                                    maxSizeMB={5000}
                                                    currentUrl={ep.videoUrl}
                                                    compact
                                                    onUpload={(url) => updateEpisode(idx, 'videoUrl', url)}
                                                    label="Episode Video (drag & drop or paste URL)"
                                                />
                                            </div>
                                            <div style={{ marginBottom: '8px' }}>
                                                <label style={epLabelStyle}>Duration</label>
                                                <input className="form-input" value={ep.duration}
                                                    onChange={e => updateEpisode(idx, 'duration', e.target.value)}
                                                    placeholder="e.g. 12 min" style={{ fontSize: '0.78rem', padding: '6px 8px' }} />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                                <div>
                                                    <label style={epLabelStyle}>Thumbnail URL</label>
                                                    <input className="form-input" value={ep.thumbnail}
                                                        onChange={e => updateEpisode(idx, 'thumbnail', e.target.value)}
                                                        placeholder="Episode thumbnail" style={{ fontSize: '0.78rem', padding: '6px 8px' }} />
                                                </div>
                                                <div>
                                                    <label style={epLabelStyle}>Description</label>
                                                    <input className="form-input" value={ep.description}
                                                        onChange={e => updateEpisode(idx, 'description', e.target.value)}
                                                        placeholder="Short description" style={{ fontSize: '0.78rem', padding: '6px 8px' }} />
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem' }}>
                                                        <input type="checkbox" checked={ep.published}
                                                            onChange={e => updateEpisode(idx, 'published', e.target.checked)} />
                                                        Published
                                                    </label>
                                                    {/* Compact subtitle lang count — full controls in Subtitles section */}
                                                    {ep.id && ep.videoUrl && (() => {
                                                        const epKey = esk('episode', ep.id)
                                                        const epCount = translationCount[epKey] ?? 0
                                                        return epCount > 0 ? (
                                                            <span style={{ fontSize: '0.68rem', color: epCount >= TOTAL_SUBTITLE_LANGS ? '#34d399' : '#f59e0b' }}>
                                                                🗨️ {epCount}/{TOTAL_SUBTITLE_LANGS}
                                                            </span>
                                                        ) : null
                                                    })()}
                                                </div>
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button type="button" onClick={() => saveEpisode(idx)} disabled={episodeSaving === (ep.id || `new-${idx}`)}
                                                        style={{
                                                            fontSize: '0.72rem', fontWeight: 600, padding: '4px 12px',
                                                            borderRadius: '6px', border: 'none', cursor: 'pointer',
                                                            background: 'rgba(52,211,153,0.15)', color: '#34d399',
                                                        }}>
                                                        {episodeSaving === (ep.id || `new-${idx}`) ? 'Saving…' : ep._new ? '➕ Create' : '💾 Save'}
                                                    </button>
                                                    {ep.id && (
                                                        <button type="button" onClick={() => deleteEpisode(idx)}
                                                            style={{
                                                                fontSize: '0.72rem', fontWeight: 600, padding: '4px 12px',
                                                                borderRadius: '6px', border: 'none', cursor: 'pointer',
                                                                background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                                            }}>
                                                            🗑
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <button type="button" onClick={addEpisode} style={{
                                        width: '100%', padding: '10px', fontSize: '0.82rem', fontWeight: 600,
                                        borderRadius: 'var(--radius-md)', border: '1px dashed rgba(212,168,83,0.3)',
                                        background: 'rgba(212,168,83,0.06)', color: 'var(--accent-gold)',
                                        cursor: 'pointer', transition: 'all 0.15s', marginTop: 'var(--space-sm)',
                                    }}>
                                        + Add Episode
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══ SUBTITLES & TRANSLATION (all project types) ══ */}
                    {!isNew && (() => {
                        const tabs: { key: string; label: string }[] = []
                        if (form.filmUrl) tabs.push({ key: 'movie', label: '🎬 Movie' })
                        if (form.trailerUrl) tabs.push({ key: 'trailer', label: '🎬 Trailer' })
                        episodes.filter(ep => ep.id && ep.videoUrl).forEach(ep => {
                            tabs.push({ key: `ep:${ep.id}`, label: `S${ep.season}E${ep.number}` })
                        })
                        if (tabs.length === 0) return null
                        const activeTab = tabs.find(t => t.key === subtitleTab) ? subtitleTab : (tabs[0]?.key ?? 'movie')
                        const { mediaType: activeMediaType, episodeId: activeEpisodeId } = parseSubTab(activeTab)
                        const activeMediaUrl = activeMediaType === 'episode'
                            ? (episodes.find(ep => ep.id === activeEpisodeId)?.videoUrl || '')
                            : activeTab === 'trailer' ? form.trailerUrl : form.filmUrl
                        const stateKey = sk(activeTab)
                        const count = translationCount[stateKey] ?? 0
                        const isFull = count >= TOTAL_SUBTITLE_LANGS
                        const phase = subtitlePhase[stateKey]
                        const isRunning = phase === 'transcribing' || phase === 'translating'
                        const progress = subtitleProgress[stateKey] ?? 0
                        const statusMsg = subtitleStatus[stateKey] || ''
                        return (
                        <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                            <SectionHeader id="subtitles" emoji="🗨️" title={`Subtitles & Translation (${count}/${TOTAL_SUBTITLE_LANGS} langs)`} />
                            {openSections.subtitles && (
                                <div style={{ paddingTop: 'var(--space-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                                    {/* Tab bar */}
                                    {tabs.length > 1 && (
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                            {tabs.map(tab => {
                                                const tabKey = sk(tab.key)
                                                const tabCount = translationCount[tabKey] ?? 0
                                                const tabFull = tabCount >= TOTAL_SUBTITLE_LANGS
                                                return (
                                                    <button key={tab.key} type="button"
                                                        onClick={() => setSubtitleTab(tab.key)}
                                                        style={{
                                                            fontSize: '0.7rem', fontWeight: 600, padding: '4px 10px',
                                                            borderRadius: '6px', border: '1px solid',
                                                            borderColor: activeTab === tab.key ? 'rgba(212,168,83,0.35)' : 'rgba(255,255,255,0.08)',
                                                            background: activeTab === tab.key ? 'rgba(212,168,83,0.18)' : 'rgba(255,255,255,0.04)',
                                                            color: activeTab === tab.key ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                                            cursor: 'pointer', transition: 'all 0.15s',
                                                        }}>
                                                        {tab.label}{tabFull ? ' ✅' : tabCount > 0 ? ` (${tabCount})` : ''}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    )}
                                    {/* Status */}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                                        {isFull ? 'All languages have been translated. You may regenerate if needed.'
                                            : count > 0 ? `${count} of ${TOTAL_SUBTITLE_LANGS} languages translated. Click CC to translate the remaining.`
                                            : 'Generate multi-language subtitles. Click Server Worker to transcribe, or upload an existing SRT/VTT.'}
                                    </div>
                                    {/* Button row */}
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {/* Server Worker */}
                                        {(() => {
                                            const sS = serverJobStatus[stateKey] as string | undefined
                                            const sMsg = serverJobMsg[stateKey] || ''
                                            const isActive = sS === 'queued' || sS === 'processing'
                                            const btnLabel = isActive ? (sS === 'processing' ? '🔄 Transcribing…' : '⏳ Queued…')
                                                : sS === 'ready' ? '🤖 Re-generate (Server)' : sS === 'failed' ? '🔁 Retry (Server)' : '🤖 Generate (Server Worker)'
                                            const c = sS === 'ready' ? '#34d399' : sS === 'failed' ? '#f87171' : '#818cf8'
                                            return (<>
                                                {sMsg && (
                                                    <div style={{ width: '100%', fontSize: '0.7rem', padding: '7px 10px', borderRadius: '8px',
                                                        background: sS === 'ready' ? 'rgba(52,211,153,0.06)' : sS === 'failed' ? 'rgba(248,113,113,0.06)' : 'rgba(129,140,248,0.06)',
                                                        border: `1px solid ${sS === 'ready' ? 'rgba(52,211,153,0.2)' : sS === 'failed' ? 'rgba(248,113,113,0.2)' : 'rgba(129,140,248,0.2)'}`,
                                                        color: sS === 'ready' ? '#34d399' : sS === 'failed' ? '#f87171' : '#a5b4fc',
                                                        marginBottom: '4px', lineHeight: 1.5 }}>{sMsg}</div>
                                                )}
                                                <button type="button"
                                                    onClick={() => activeMediaUrl && handleServerGenerate(activeMediaUrl, activeMediaType, activeEpisodeId)}
                                                    disabled={isActive || !activeMediaUrl}
                                                    title="Runs faster-whisper on your local worker"
                                                    style={{ fontSize: '0.72rem', fontWeight: 700, padding: '6px 14px', borderRadius: '8px',
                                                        background: isActive ? 'rgba(255,255,255,0.04)' : 'rgba(129,140,248,0.12)',
                                                        border: `1px solid ${isActive ? 'rgba(255,255,255,0.08)' : 'rgba(129,140,248,0.3)'}`,
                                                        color: isActive ? 'var(--text-tertiary)' : c,
                                                        cursor: isActive ? 'not-allowed' : 'pointer' }}>{btnLabel}</button>
                                            </>)
                                        })()}
                                        <div style={{ width: '100%', fontSize: '0.6rem', color: 'var(--text-tertiary)', opacity: 0.55, marginBottom: '-2px' }}>
                                            ⬆ Server worker &nbsp;·&nbsp; ⬇ Browser fallback — manual only
                                        </div>
                                        {/* CC (Browser Fallback) */}
                                        <button type="button"
                                            onClick={() => activeMediaUrl && handleGenerateSubtitles(activeMediaUrl, activeMediaType, activeEpisodeId)}
                                            disabled={isRunning || !activeMediaUrl}
                                            style={{ fontSize: '0.72rem', fontWeight: 700, padding: '6px 14px', borderRadius: '8px',
                                                background: isRunning ? 'rgba(255,255,255,0.04)' : 'rgba(212,168,83,0.12)',
                                                border: `1px solid ${isRunning ? 'rgba(255,255,255,0.08)' : 'rgba(212,168,83,0.3)'}`,
                                                color: isRunning ? 'var(--text-tertiary)' : 'var(--accent-gold)',
                                                cursor: isRunning ? 'not-allowed' : 'pointer' }}>
                                            {phase === 'transcribing' ? '⏳ Transcribing…' : phase === 'translating' ? '🌍 Translating…' : translateStatus[stateKey] === 'partial' ? '↻ Resume Translation' : isFull ? 'CC ✓ Regenerate' : '🎬 Generate Subtitles (CC)'}
                                        </button>
                                        {/* Upload SRT / VTT */}
                                        <label title="Upload an existing SRT or VTT transcript"
                                            style={{ fontSize: '0.72rem', fontWeight: 700, padding: '6px 14px', borderRadius: '8px',
                                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                                                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)' }}>
                                            📄 Upload SRT / VTT
                                            <input type="file" accept=".srt,.vtt" style={{ display: 'none' }}
                                                onChange={async e => { const file = e.target.files?.[0]; if (!file) return; e.target.value = ''; await handleSrtUpload(file, activeMediaType, activeEpisodeId) }} />
                                        </label>
                                        {/* Edit Subtitles */}
                                        {(serverJobStatus[stateKey] === 'ready' || count > 0 || translateStatus[stateKey] === 'complete' || translateStatus[stateKey] === 'partial') && (
                                            <button type="button" onClick={() => openSubtitleEditor(activeMediaUrl || null, activeMediaType, activeEpisodeId)}
                                                title="Open subtitle editor"
                                                style={{ fontSize: '0.72rem', fontWeight: 700, padding: '6px 14px', borderRadius: '8px',
                                                    background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', cursor: 'pointer' }}>
                                                ✏️ Edit Subtitles
                                            </button>
                                        )}
                                        {/* Translate — gated on approval */}
                                        {(() => {
                                            const approval = subtitleApproval[stateKey] || translateStatus[stateKey]
                                            const isApproved = approval === 'approved_source'
                                            const hasSubtitles = (serverJobStatus[stateKey] === 'ready') || (count > 0)
                                            if (!hasSubtitles) return null
                                            return (
                                                <button type="button" disabled={!isApproved || isRunning}
                                                    title={!isApproved ? 'Edit subtitles and click "Approve Source" before translating' : 'Translate to all languages'}
                                                    onClick={() => isApproved && activeMediaUrl && handleGenerateSubtitles(activeMediaUrl, activeMediaType, activeEpisodeId)}
                                                    style={{ fontSize: '0.72rem', fontWeight: 700, padding: '6px 14px', borderRadius: '8px',
                                                        background: isApproved ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)',
                                                        border: `1px solid ${isApproved ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                                        color: isApproved ? '#34d399' : 'var(--text-tertiary)',
                                                        cursor: (!isApproved || isRunning) ? 'not-allowed' : 'pointer',
                                                        opacity: (!isApproved || isRunning) ? 0.6 : 1 }}>
                                                    {isRunning ? '🌍 Translating…' : isApproved ? '🌍 Translate All' : '🔒 Approve first'}
                                                </button>
                                            )
                                        })()}
                                        {/* Review Subtitles */}
                                        {(serverJobStatus[stateKey] === 'ready' || translateStatus[stateKey] === 'complete' || translateStatus[stateKey] === 'partial' || count > 0) && (
                                            <button type="button" onClick={() => openSubtitleEditor(activeMediaUrl || null, activeMediaType, activeEpisodeId)}
                                                title="Review and edit subtitles"
                                                style={{ fontSize: '0.72rem', fontWeight: 700, padding: '6px 14px', borderRadius: '8px',
                                                    background: 'rgba(212,168,83,0.06)', border: '1px solid rgba(212,168,83,0.2)', color: 'var(--accent-gold)', cursor: 'pointer' }}>
                                                🔍 Review Subtitles
                                            </button>
                                        )}
                                    </div>
                                    {/* Progress bar */}
                                    {progress > 0 && progress < 100 && (
                                        <div>
                                            <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                                                <div style={{ height: '100%', borderRadius: '3px', background: 'linear-gradient(90deg, var(--accent-gold), #e8c547)',
                                                    width: `${progress}%`, transition: 'width 0.4s ease', boxShadow: '0 0 8px rgba(212,168,83,0.4)' }} />
                                            </div>
                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{statusMsg}</span><span>{progress}%</span>
                                            </div>
                                        </div>
                                    )}
                                    {(progress === 0 || progress >= 100) && statusMsg && (
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', padding: '6px 10px', borderRadius: '8px',
                                            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                            {statusMsg}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        )
                    })()}

                    {/* ══ MOVIE ROLLS ══ */}
                    <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }} id="roll-assignment-section">
                        <SectionHeader id="rolls" emoji="🎞️" title="Movie Roll Assignment" />
                        {openSections.rolls && (
                            <div style={{ paddingTop: 'var(--space-sm)' }}>
                                {rollsLoading ? (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Loading rolls…</p>
                                ) : allRolls.length === 0 ? (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>No movie rolls configured yet.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {allRolls.map(roll => {
                                            const isSelected = selectedRollIds.includes(roll.id)
                                            return (
                                                <label key={roll.id} style={{
                                                    display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                                                    padding: '8px 12px', borderRadius: 'var(--radius-md)',
                                                    background: isSelected ? 'rgba(212,168,83,0.1)' : 'transparent',
                                                    border: isSelected ? '1px solid rgba(212,168,83,0.3)' : '1px solid var(--border-subtle)',
                                                    transition: 'all 0.15s',
                                                }}>
                                                    <input type="checkbox" checked={isSelected}
                                                        onChange={() => setSelectedRollIds(prev =>
                                                            isSelected ? prev.filter(x => x !== roll.id) : [...prev, roll.id]
                                                        )} />
                                                    <span>{roll.icon}</span>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: isSelected ? 600 : 400 }}>{roll.title}</span>
                                                </label>
                                            )
                                        })}
                                        {rollError && <p style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: 4 }}>Select at least one roll.</p>}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ══ STICKY SAVE BAR ══ */}
                    {saveSuccess && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-md)',
                            fontSize: '0.85rem', fontWeight: 600, padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)',
                            color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)' }}>
                            ✓ Project saved successfully
                        </div>
                    )}
                    {error && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: 'var(--space-md)',
                            fontSize: '0.85rem', fontWeight: 600, padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-md)',
                            color: 'var(--error)', background: 'rgba(239,68,68,0.1)' }}>
                            <span style={{ flex: 1 }}>✗ {error}</span>
                            <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '1rem' }}>✕</button>
                        </div>
                    )}

                    <div style={{
                        position: 'sticky', bottom: 0, background: 'var(--bg-secondary)',
                        borderTop: '1px solid var(--border-subtle)',
                        padding: 'var(--space-md) 0', display: 'flex', gap: 'var(--space-md)',
                        justifyContent: 'flex-end', zIndex: 10,
                    }}>
                        <button type="button" onClick={() => router.push('/admin/projects')} className="btn btn-ghost">Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : isNew ? '🎬 Create Project' : '💾 Save Changes'}
                        </button>
                    </div>
                </form>
            </main>

            {/* Publish gate */}
            {showPublishWarning && (
                <PublishGateModal
                    isOpen={true}
                    translatedCount={translationCount[sk('movie')] ?? 0}
                    saving={saving}
                    onConfirm={() => { setShowPublishWarning(false); doSave(true) }}
                    onCancel={() => setShowPublishWarning(false)}
                />
            )}

            {/* ── Subtitle Editor modal ── */}
            {editorProjectId && (
                <SubtitleEditor
                    projectId={editorProjectId}
                    episodeId={editorEpisodeId}
                    mediaType={editorMediaType}
                    initialSegments={editorSegments}
                    currentStatus={editorStatus}
                    filmUrl={editorFilmUrl}
                    initialPlacement={editorInitialPlacement}
                    initialMobilePlacement={editorInitialMobilePlacement}
                    initialLandscapePlacement={editorInitialLandscapePlacement}
                    useSeparateMobilePlacement={editorUseSeparateMobile}
                    onClose={() => setEditorProjectId(null)}
                    onSaved={(newStatus) => {
                        const edKey = editorEpisodeId ? sk(`ep:${editorEpisodeId}`) : sk(editorMediaType)
                        setSubtitleApproval(prev => ({ ...prev, [edKey]: newStatus }))
                    }}
                />
            )}
        </div>
    )
}
