'use client'
// Force rebuild 1

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'

import AdminSidebar from '@/components/AdminSidebar'
import SubtitleProgressBar from '@/components/admin/SubtitleProgressBar'
import SubtitleEditor, { type SubtitleCue } from '@/components/admin/SubtitleEditor'
import FileUploader from '@/components/FileUploader'
import { TOTAL_SUBTITLE_LANGS, SUBTITLE_TARGET_LANGS, LANGUAGE_NAMES, requiresTranslationGate, isBlockedStreamingUrl } from '@/config/subtitles'
import PublishGateModal from '@/components/admin/PublishGateModal'
import { transcribeVideo } from '@/lib/transcribe-client'
import { runQC, formatQCSummary, type QCResult } from '@/lib/subtitle-qc'
import { uploadSubtitleFile } from '@/lib/subtitle-file-parser'
import { readSSEStream } from '@/lib/sse-reader'
import LangStatusGrid from '@/components/admin/LangStatusGrid'

/* ── Types ── */
type FormData = {
    title: string; slug: string; tagline: string; description: string
    status: string; genre: string; year: string; duration: string
    featured: boolean; published: boolean; coverImage: string
    trailerUrl: string; filmUrl: string; projectType: string
    gallery: string; credits: string; sponsorData: string
    // Mobile media (merged from inline modal)
    mobileCoverImage: string; mobileGallery: string
    // Publishing controls (merged from inline modal)
    subtitlesPublic: boolean; publishAt: string
    // Content Advisory
    contentRating: string; contentDescriptors: string[]; advisoryDisplaySeconds: string
    // Player Timings
    introStartSeconds: string; introEndSeconds: string; creditsStartSeconds: string
}

const EMPTY_FORM: FormData = {
    title: '', slug: '', tagline: '', description: '',
    status: 'upcoming', genre: '', year: '', duration: '',
    featured: false, published: false, coverImage: '',
    trailerUrl: '', filmUrl: '', projectType: 'movie',
    gallery: '', credits: '', sponsorData: '',
    mobileCoverImage: '', mobileGallery: '',
    subtitlesPublic: false, publishAt: '',
    contentRating: '', contentDescriptors: [], advisoryDisplaySeconds: '',
    introStartSeconds: '', introEndSeconds: '', creditsStartSeconds: '',
}

/* ── Cast management types (merged from projects list modal) ── */
type FilmCastMember = {
    id: string; name: string; jobTitle: string; character: string | null
    bio: string | null; photoUrl: string | null; instagramUrl: string | null
    bioTranslations: string | null; sortOrder: number
}
type CastForm = { name: string; jobTitle: string; character: string; bio: string; photoUrl: string; instagramUrl: string }
const EMPTY_CAST_FORM: CastForm = { name: '', jobTitle: 'Actor', character: '', bio: '', photoUrl: '', instagramUrl: '' }

/* ── Review modal types (ported from projects list page) ── */
type ReviewSegment = { start: number; end: number; text: string }
type ReviewSubtitle = {
    segments: ReviewSegment[]
    translations: Record<string, ReviewSegment[]>
    qcIssues: QCResult[]
    translateStatus: string
    transcribedWith: string | null
    generatedWith: string | null
    langStatus: Record<string, string> | null
}

const STATUSES = ['upcoming', 'in-production', 'completed']
const GENRES = ['Action','Adventure','Animation','Biography','Comedy','Crime','Documentary','Drama','Fantasy','Historical','Horror','Musical','Mystery','Romance','Sci-Fi','Short Film','Thriller','War','Western']
const CONTENT_RATINGS = ['G','PG','PG-13','R','TV-Y','TV-Y7','TV-G','TV-PG','TV-14','TV-MA']
const CONTENT_DESCRIPTORS = [
    { key: 'violence', label: 'Violence' },
    { key: 'strong_language', label: 'Strong Language' },
    { key: 'mild_language', label: 'Mild Language' },
    { key: 'nudity', label: 'Nudity' },
    { key: 'sexual_content', label: 'Sexual Content' },
    { key: 'drug_use', label: 'Drug Use' },
    { key: 'alcohol_use', label: 'Alcohol Use' },
    { key: 'smoking', label: 'Smoking' },
    { key: 'frightening_scenes', label: 'Frightening Scenes' },
    { key: 'thematic_elements', label: 'Thematic Elements' },
]

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

    // Publishing (merged from inline modal)
    const [wasPublished, setWasPublished] = useState(false)
    const [resending, setResending] = useState(false)
    const [notifyGroups, setNotifyGroups] = useState<{ subscribers: boolean; members: boolean; cast: boolean }>({
        subscribers: false, members: false, cast: false,
    })

    // Cast management (merged from inline modal)
    const [castMembers, setCastMembers] = useState<FilmCastMember[]>([])
    const [castForm, setCastForm] = useState<CastForm>(EMPTY_CAST_FORM)
    const [castLoading, setCastLoading] = useState(false)
    const [castSaving, setCastSaving] = useState(false)
    const [castError, setCastError] = useState('')
    const [translatingCastId, setTranslatingCastId] = useState<string | null>(null)

    // Delete project
    const [isDeleting, setIsDeleting] = useState(false)

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

    // ── Subtitle Review modal ──
    const [reviewProjectId, setReviewProjectId] = useState<string | null>(null)
    const [reviewMediaType, setReviewMediaType] = useState<string>('movie')
    const [reviewEpisodeId, setReviewEpisodeId] = useState<string | null>(null)
    const [reviewEpisodeLabel, setReviewEpisodeLabel] = useState<string>('')
    const [reviewData, setReviewData] = useState<ReviewSubtitle | null>(null)
    const [reviewLang, setReviewLang] = useState('en')
    const [reviewLoading, setReviewLoading] = useState(false)
    const [retryingLang, setRetryingLang] = useState<string | null>(null)
    const reviewRequestRef = useRef(0)

    // ── Per-track subtitle visibility ──
    const [subtitleVisibility, setSubtitleVisibility] = useState<Record<string, boolean>>({})

    // Publish gate

    const [showPublishWarning, setShowPublishWarning] = useState(false)

    // Episodes
    type EpisodeRow = {
        id?: string; title: string; number: number; season: number
        videoUrl: string; duration: string; description: string
        thumbnail: string; published: boolean; _dirty?: boolean; _new?: boolean
        // Player Timings override + sort order
        introStartSeconds: string; introEndSeconds: string; creditsStartSeconds: string
        sortOrder: string
    }
    const [episodes, setEpisodes] = useState<EpisodeRow[]>([])
    const [episodeSaving, setEpisodeSaving] = useState<string | null>(null)

    // Section collapse state
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        basic: true, status: true, media: true, advisory: false, timings: false,
        episodes: false, sponsor: false, gallery: false, subtitles: false, rolls: false,
        cast: false, danger: false,
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
            fetch(`/api/admin/cast?projectId=${projectId}`).then(r => r.ok ? r.json() : { cast: [] }).catch(() => ({ cast: [] })),
        ]).then(([projects, rolls, assignedIds, subData, castData]) => {
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
                mobileCoverImage: p.mobileCoverImage || '',
                mobileGallery: p.mobileGallery || '',
                subtitlesPublic: p.subtitlesPublic ?? false,
                publishAt: p.publishAt ? new Date(p.publishAt).toISOString().slice(0, 16) : '',
                contentRating: p.contentRating || '',
                contentDescriptors: Array.isArray(p.contentDescriptors) ? p.contentDescriptors : [],
                advisoryDisplaySeconds: p.advisoryDisplaySeconds != null ? String(p.advisoryDisplaySeconds) : '',
                introStartSeconds: p.introStartSeconds != null ? String(p.introStartSeconds) : '',
                introEndSeconds: p.introEndSeconds != null ? String(p.introEndSeconds) : '',
                creditsStartSeconds: p.creditsStartSeconds != null ? String(p.creditsStartSeconds) : '',
            })
            setWasPublished(p.published ?? false)
            setOriginalTitle(p.title)
            setCastMembers((castData as any).cast || [])
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
                    .then((res: { subtitle?: { status?: string; segments?: string; translations?: string; translateStatus?: string; subtitlesPublic?: boolean } }) => {
                        if (res.subtitle?.status) setSubtitleApproval(prev => ({ ...prev, [key]: res.subtitle!.status! }))
                        // Read per-track subtitle visibility
                        if (res.subtitle?.subtitlesPublic !== undefined) {
                            setSubtitleVisibility(s => ({ ...s, [key]: res.subtitle!.subtitlesPublic! }))
                        }
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
                            introStartSeconds: e.introStartSeconds != null ? String(e.introStartSeconds) : '',
                            introEndSeconds: e.introEndSeconds != null ? String(e.introEndSeconds) : '',
                            creditsStartSeconds: e.creditsStartSeconds != null ? String(e.creditsStartSeconds) : '',
                            sortOrder: e.sortOrder != null ? String(e.sortOrder) : '',
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
        // Validate player timings
        const iS = form.introStartSeconds !== '' ? Number(form.introStartSeconds) : null
        const iE = form.introEndSeconds !== '' ? Number(form.introEndSeconds) : null
        const cS = form.creditsStartSeconds !== '' ? Number(form.creditsStartSeconds) : null
        if (iS !== null && (isNaN(iS) || iS < 0)) { setError('Intro Start must be a non-negative number.'); return }
        if (iE !== null && (isNaN(iE) || iE < 0)) { setError('Intro End must be a non-negative number.'); return }
        if (cS !== null && (isNaN(cS) || cS <= 0)) { setError('Credits Start must be greater than 0.'); return }
        if (iS !== null && iE !== null && iE <= iS) { setError('Intro End must be greater than Intro Start.'); return }
        setSaving(true); setError(''); setRollError(false)
        try {
            const payload = {
                ...form,
                slug: form.slug || slugify(form.title),
                publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
                notifyGroups: form.published ? notifyGroups : undefined,
                publishNotifyGroups: form.publishAt && !form.published
                    ? JSON.stringify(notifyGroups)
                    : undefined,
                contentRating: form.contentRating || null,
                advisoryDisplaySeconds: form.advisoryDisplaySeconds !== '' ? Number(form.advisoryDisplaySeconds) : null,
                introStartSeconds: form.introStartSeconds !== '' ? Number(form.introStartSeconds) : null,
                introEndSeconds: form.introEndSeconds !== '' ? Number(form.introEndSeconds) : null,
                creditsStartSeconds: form.creditsStartSeconds !== '' ? Number(form.creditsStartSeconds) : null,
            }
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
            if (isNew) {
                // Navigate to the real edit URL so the form loads the saved project
                router.push(`/admin/projects/${saved.id}/edit`)
            } else {
                // Refresh server data so the admin sees saved values immediately
                router.refresh()
                setSaveSuccess(true)
                setTimeout(() => setSaveSuccess(false), 3000)
            }
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
            introStartSeconds: '', introEndSeconds: '', creditsStartSeconds: '', sortOrder: '',
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
                introStartSeconds: ep.introStartSeconds !== '' ? Number(ep.introStartSeconds) : null,
                introEndSeconds: ep.introEndSeconds !== '' ? Number(ep.introEndSeconds) : null,
                creditsStartSeconds: ep.creditsStartSeconds !== '' ? Number(ep.creditsStartSeconds) : null,
                sortOrder: ep.sortOrder !== '' ? Number(ep.sortOrder) : null,
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

    // ── Cast management handlers (merged from projects list modal) ──

    const handleAddCastMember = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!castForm.name.trim() || !castForm.jobTitle.trim()) {
            setCastError('Name and Job Title are required')
            return
        }
        if (isNew) { setCastError('Save the project first, then add cast members'); return }
        setCastSaving(true); setCastError('')
        try {
            const res = await fetch('/api/admin/cast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, ...castForm, sortOrder: castMembers.length }),
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
        } catch { alert('Failed to delete cast member') }
    }

    const handleTranslateCastMember = async (m: FilmCastMember) => {
        if (!m.bio && !m.character) {
            alert('Add a bio or character name first before translating.')
            return
        }
        setTranslatingCastId(m.id)
        try {
            const res = await fetch(`/api/admin/cast/${m.id}/translate`, { method: 'POST' })
            if (!res.ok) throw new Error()
            const { member } = await res.json()
            setCastMembers(prev => prev.map(c => c.id === m.id ? { ...c, bioTranslations: member.bioTranslations } : c))
        } catch { alert('Translation failed — check API key or try again.') }
        setTranslatingCastId(null)
    }

    // ── Delete project handler ──

    const handleDeleteProject = async () => {
        if (isNew) return
        if (!confirm(`Permanently delete "${form.title || 'this project'}"? This will also remove all its casting calls and applications. This cannot be undone.`)) return
        if (!confirm(`Second confirmation: delete "${form.title}"?`)) return
        setIsDeleting(true)
        try {
            const res = await fetch(`/api/admin/projects/${projectId}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete project')
            router.push('/admin/projects')
        } catch { alert('Failed to delete project. Please try again.'); setIsDeleting(false) }
    }

    // ── Resend notifications handler ──

    const handleResend = async () => {
        if (!confirm('Re-send publish notifications to the selected audience groups? This will send emails NOW.')) return
        setResending(true)
        try {
            const res = await fetch(`/api/admin/projects/${projectId}/resend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notifyGroups }),
            })
            if (res.ok) {
                alert('Notifications queued for the selected audience.')
            } else {
                alert('Failed to send notifications. Please try again.')
            }
        } catch { alert('Network error. Please try again.') }
        setResending(false)
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

    /** Open the Subtitle Review modal (read-only status view) */
    const openReview = async (mediaType: string = 'movie', episodeId?: string | null, episodeLabel?: string) => {
        const requestId = ++reviewRequestRef.current
        setReviewProjectId(projectId)
        setReviewMediaType(mediaType)
        setReviewEpisodeId(episodeId ?? null)
        setReviewEpisodeLabel(episodeLabel ?? '')
        setReviewLang('en')
        setReviewData(null)
        setReviewLoading(true)
        setRetryingLang(null)
        try {
            const epQs = episodeId ? `&episodeId=${episodeId}` : ''
            const res = await fetch(`/api/admin/subtitles?projectId=${projectId}&mediaType=${mediaType}${epQs}`)
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

    /** Retry a single failed/pending language via SSE */
    const retryLang = async (lang: string) => {
        if (!reviewProjectId || retryingLang === lang) return
        setRetryingLang(lang)
        try {
            const res = await fetch('/api/admin/subtitles/retry-lang', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId: reviewProjectId, lang, mediaType: reviewMediaType }),
            })
            if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
            setReviewData(prev => prev ? {
                ...prev,
                langStatus: { ...(prev.langStatus ?? {}), [lang]: 'processing' },
            } : prev)
            await readSSEStream<{ phase?: string; lang?: string }>(res.body.getReader(), async (data) => {
                if (data.phase === 'done') {
                    const epQs = reviewEpisodeId ? `&episodeId=${reviewEpisodeId}` : ''
                    const freshRes = await fetch(`/api/admin/subtitles?projectId=${reviewProjectId}&mediaType=${reviewMediaType}${epQs}`)
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

    /** Delete subtitle content from the review modal — scoped by mediaType */
    const handleDeleteSubtitle = async (deleteType: 'source' | 'translation', language?: string) => {
        if (!reviewProjectId) return

        const mediaLabel = reviewMediaType === 'trailer' ? 'Trailer' : reviewMediaType === 'episode' ? (reviewEpisodeLabel || 'Episode') : 'Movie'
        const confirmMsg = deleteType === 'translation' && language
            ? `Are you sure you want to delete ${mediaLabel} ${language.toUpperCase()} translation?\n\nThis cannot be undone.`
            : `Are you sure you want to delete all ${mediaLabel} subtitles (source + translations)?\n\nThis cannot be undone.`
        if (!confirm(confirmMsg)) return

        try {
            const res = await fetch('/api/admin/subtitles', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId: reviewProjectId,
                    mediaType: reviewMediaType,
                    episodeId: reviewEpisodeId ?? undefined,
                    deleteType,
                    language,
                }),
            })
            const d = await res.json()
            if (!res.ok) throw new Error(d.error || 'Delete failed')

            if (deleteType === 'source') {
                const key = reviewEpisodeId ? sk(`ep:${reviewEpisodeId}`) : sk(reviewMediaType)
                setTranslationCount(s => ({ ...s, [key]: 0 }))
                setTranslateStatus(s => ({ ...s, [key]: 'pending' }))
                setSubtitlePhase(s => ({ ...s, [key]: null }))
                setSubtitleStatus(s => { const n = { ...s }; delete n[key]; return n })
                setServerJobStatus(s => ({ ...s, [key]: 'idle' }))
                closeReview()
            } else {
                const epQs = reviewEpisodeId ? `&episodeId=${reviewEpisodeId}` : ''
                const freshRes = await fetch(`/api/admin/subtitles?projectId=${reviewProjectId}&mediaType=${reviewMediaType}${epQs}`)
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
            }
        } catch (err) {
            alert(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
    }

    const closeReview = () => {
        setReviewProjectId(null)
        setReviewData(null)
        setReviewMediaType('movie')
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
                                <div style={{ display: 'flex', gap: 'var(--space-xl)', paddingTop: 'var(--space-sm)', flexWrap: 'wrap' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input type="checkbox" checked={form.featured} onChange={e => updateField('featured', e.target.checked)} />
                                        ⭐ Featured
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input type="checkbox" checked={form.published} onChange={e => updateField('published', e.target.checked)} />
                                        🌐 Published
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                        <input type="checkbox" checked={form.subtitlesPublic} onChange={e => updateField('subtitlesPublic', e.target.checked)} />
                                        🗨️ Subtitles Public
                                    </label>
                                </div>

                                {/* Scheduled Publish */}
                                <div>
                                    <label className="form-label">Schedule Publish At</label>
                                    <input className="form-input" type="datetime-local"
                                        value={form.publishAt}
                                        onChange={e => updateField('publishAt', e.target.value)} />
                                    <p style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', marginTop: '3px' }}>
                                        Optional. Leave blank to publish immediately when Published is checked. A scheduled time will publish automatically.
                                    </p>
                                </div>

                                {/* Notification audience */}
                                {!isNew && (
                                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-md)' }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                            📣 Notification Audience
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)' }}>
                                            {wasPublished
                                                ? 'Project is already published. Select groups and use Re-send to notify additional users.'
                                                : form.publishAt
                                                    ? 'Who gets notified when the scheduled publish fires.'
                                                    : 'Who gets the email on first publish. Does not fire on re-saves.'}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            {([
                                                { key: 'subscribers' as const, icon: '📬', label: 'Newsletter Subscribers', desc: 'Signed-up subscribers (not members).' },
                                                { key: 'members' as const, icon: '👥', label: 'Registered Members', desc: 'Logged-in users with notifications enabled.' },
                                                { key: 'cast' as const, icon: '🎭', label: 'Cast Members', desc: 'Users who applied to casting on this project.' },
                                            ]).map(group => (
                                                <label key={group.key} style={{
                                                    display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer',
                                                    padding: '7px 10px', borderRadius: 'var(--radius-md)',
                                                    background: notifyGroups[group.key] ? 'rgba(192,132,252,0.06)' : 'transparent',
                                                    border: `1px solid ${notifyGroups[group.key] ? 'rgba(192,132,252,0.2)' : 'rgba(255,255,255,0.04)'}`,
                                                    transition: 'all 0.15s',
                                                }}>
                                                    <input type="checkbox" checked={notifyGroups[group.key]}
                                                        onChange={e => setNotifyGroups(prev => ({ ...prev, [group.key]: e.target.checked }))}
                                                        style={{ width: '14px', height: '14px', accentColor: '#c084fc', marginTop: '2px', flexShrink: 0 }} />
                                                    <div>
                                                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{group.icon} {group.label}</div>
                                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>{group.desc}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>

                                        {/* Resend button — only for already-published projects */}
                                        {wasPublished && (
                                            <button
                                                type="button"
                                                disabled={resending || (!notifyGroups.subscribers && !notifyGroups.members && !notifyGroups.cast)}
                                                onClick={handleResend}
                                                style={{
                                                    marginTop: '10px', fontSize: '0.78rem', fontWeight: 700,
                                                    padding: '8px 16px', borderRadius: 'var(--radius-md)',
                                                    background: (!notifyGroups.subscribers && !notifyGroups.members && !notifyGroups.cast)
                                                        ? 'rgba(255,255,255,0.04)' : 'rgba(192,132,252,0.12)',
                                                    border: `1px solid ${(!notifyGroups.subscribers && !notifyGroups.members && !notifyGroups.cast) ? 'rgba(255,255,255,0.06)' : 'rgba(192,132,252,0.3)'}`,
                                                    color: (!notifyGroups.subscribers && !notifyGroups.members && !notifyGroups.cast) ? 'var(--text-tertiary)' : '#c084fc',
                                                    cursor: resending || (!notifyGroups.subscribers && !notifyGroups.members && !notifyGroups.cast) ? 'not-allowed' : 'pointer',
                                                    opacity: resending ? 0.6 : 1,
                                                }}
                                            >
                                                {resending ? '⏳ Sending...' : '📩 Re-send Notifications'}
                                            </button>
                                        )}
                                    </div>
                                )}
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

                                {/* Mobile Cover Image */}
                                <div>
                                    <label className="form-label">Mobile Cover Image <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 400 }}>(portrait-optimised, overrides desktop poster on mobile)</span></label>
                                    <FileUploader
                                        category="projects" accept="image/*"
                                        currentUrl={form.mobileCoverImage}
                                        onUpload={(url) => updateField('mobileCoverImage', url)}
                                        label="Mobile Cover Image"
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

                    {/* ══ CONTENT ADVISORY ══ */}
                    <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                        <SectionHeader id="advisory" emoji="🛡️" title="Content Advisory" />
                        {openSections.advisory && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingTop: 'var(--space-sm)' }}>
                                <div>
                                    <label className="form-label">Content Rating</label>
                                    <select className="form-input" value={form.contentRating}
                                        onChange={e => updateField('contentRating', e.target.value)}>
                                        <option value="">Not Rated / Not Set</option>
                                        {CONTENT_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Content Descriptors</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '6px' }}>
                                        {CONTENT_DESCRIPTORS.map(d => {
                                            const checked = form.contentDescriptors.includes(d.key)
                                            return (
                                                <label key={d.key} style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                                                    fontSize: '0.78rem', padding: '4px 8px', borderRadius: '6px',
                                                    background: checked ? 'rgba(212,168,83,0.1)' : 'transparent',
                                                    border: checked ? '1px solid rgba(212,168,83,0.3)' : '1px solid transparent',
                                                    transition: 'all 0.15s',
                                                }}>
                                                    <input type="checkbox" checked={checked}
                                                        onChange={() => {
                                                            const next = checked
                                                                ? form.contentDescriptors.filter(k => k !== d.key)
                                                                : [...form.contentDescriptors, d.key]
                                                            setForm(f => ({ ...f, contentDescriptors: next }))
                                                        }} />
                                                    {d.label}
                                                </label>
                                            )
                                        })}
                                    </div>
                                    <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                                        Checked items appear in the content warning shown to viewers before they watch.
                                    </p>
                                </div>
                                <div style={{ maxWidth: '200px' }}>
                                    <label className="form-label">Advisory Display Duration (s)</label>
                                    <input className="form-input" type="number" min={1} max={30} step={1}
                                        value={form.advisoryDisplaySeconds}
                                        onChange={e => updateField('advisoryDisplaySeconds', e.target.value)}
                                        placeholder="Default: 5" />
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                        Seconds the overlay stays on screen before fading out.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ══ PLAYER TIMINGS ══ */}
                    <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                        <SectionHeader id="timings" emoji="⏱️" title="Player Timings" />
                        {openSections.timings && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', paddingTop: 'var(--space-sm)' }}>
                                <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', margin: 0 }}>
                                    All values in seconds. Leave blank to disable. For Series, these apply to every episode unless an episode-level override exists.
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                                    <div>
                                        <label className="form-label">Intro Start (s)</label>
                                        <input className="form-input" type="number" min={0} step={1}
                                            value={form.introStartSeconds}
                                            onChange={e => updateField('introStartSeconds', e.target.value)}
                                            placeholder="e.g. 30" />
                                    </div>
                                    <div>
                                        <label className="form-label">Intro End (s)</label>
                                        <input className="form-input" type="number" min={0} step={1}
                                            value={form.introEndSeconds}
                                            onChange={e => updateField('introEndSeconds', e.target.value)}
                                            placeholder="e.g. 105" />
                                        <p style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                            Skip Intro seeks here
                                        </p>
                                    </div>
                                    <div>
                                        <label className="form-label">Credits Start (s)</label>
                                        <input className="form-input" type="number" min={1} step={1}
                                            value={form.creditsStartSeconds}
                                            onChange={e => updateField('creditsStartSeconds', e.target.value)}
                                            placeholder="e.g. 2520" />
                                    </div>
                                </div>
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
                                    <label className="form-label">Mobile Gallery <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>(portrait images for mobile — one URL per line)</span></label>
                                    <textarea className="form-input" rows={2} value={form.mobileGallery} onChange={e => updateField('mobileGallery', e.target.value)}
                                        placeholder={"https://cdn.example.com/mobile-still-1.jpg\nhttps://cdn.example.com/mobile-still-2.jpg"}
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
                                            {/* Episode-level timing overrides + sort order */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px', gap: '6px', marginBottom: '8px' }}>
                                                <div>
                                                    <label style={epLabelStyle}>Intro Start (s)</label>
                                                    <input className="form-input" type="number" min={0} step={1}
                                                        value={ep.introStartSeconds}
                                                        onChange={e => updateEpisode(idx, 'introStartSeconds', e.target.value)}
                                                        placeholder="inherit" style={{ fontSize: '0.72rem', padding: '4px 6px' }} />
                                                </div>
                                                <div>
                                                    <label style={epLabelStyle}>Intro End (s)</label>
                                                    <input className="form-input" type="number" min={0} step={1}
                                                        value={ep.introEndSeconds}
                                                        onChange={e => updateEpisode(idx, 'introEndSeconds', e.target.value)}
                                                        placeholder="inherit" style={{ fontSize: '0.72rem', padding: '4px 6px' }} />
                                                </div>
                                                <div>
                                                    <label style={epLabelStyle}>Credits (s)</label>
                                                    <input className="form-input" type="number" min={1} step={1}
                                                        value={ep.creditsStartSeconds}
                                                        onChange={e => updateEpisode(idx, 'creditsStartSeconds', e.target.value)}
                                                        placeholder="inherit" style={{ fontSize: '0.72rem', padding: '4px 6px' }} />
                                                </div>
                                                <div>
                                                    <label style={epLabelStyle}>Sort #</label>
                                                    <input className="form-input" type="number" step={1}
                                                        value={ep.sortOrder}
                                                        onChange={e => updateEpisode(idx, 'sortOrder', e.target.value)}
                                                        placeholder="auto" style={{ fontSize: '0.72rem', padding: '4px 6px' }} />
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
                                    {/* Per-track subtitle visibility toggle */}
                                    {(() => {
                                        const isVisible = subtitleVisibility[stateKey] ?? false
                                        const handleToggle = async () => {
                                            const next = !isVisible
                                            // Optimistic update
                                            setSubtitleVisibility(s => ({ ...s, [stateKey]: next }))
                                            try {
                                                await fetch('/api/admin/subtitles/visibility', {
                                                    method: 'PATCH',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        projectId,
                                                        mediaType: activeMediaType === 'episode' ? 'episode' : activeMediaType,
                                                        episodeId: activeEpisodeId ?? null,
                                                        subtitlesPublic: next,
                                                    }),
                                                })
                                            } catch {
                                                // Revert on failure
                                                setSubtitleVisibility(s => ({ ...s, [stateKey]: isVisible }))
                                            }
                                        }
                                        return (
                                            <button
                                                type="button"
                                                onClick={handleToggle}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                                                    fontSize: '0.78rem', fontWeight: 700,
                                                    background: isVisible ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)',
                                                    border: `1px solid ${isVisible ? 'rgba(52,211,153,0.35)' : 'rgba(255,255,255,0.1)'}`,
                                                    color: isVisible ? '#34d399' : 'var(--text-tertiary)',
                                                    transition: 'all 0.2s',
                                                }}
                                                title={isVisible ? 'Click to hide subtitles from users for this video' : 'Click to make subtitles visible to users for this video'}
                                            >
                                                <span style={{ fontSize: '1rem' }}>{isVisible ? '🌐' : '🔒'}</span>
                                                {isVisible ? 'Subtitles visible to users' : 'Subtitles hidden from users'}
                                                <span style={{ fontSize: '0.6rem', opacity: 0.6, fontWeight: 400 }}>
                                                    ({activeTab === 'movie' ? 'Movie' : activeTab === 'trailer' ? 'Trailer' : tabs.find(t => t.key === activeTab)?.label ?? 'Episode'})
                                                </span>
                                            </button>
                                        )
                                    })()}
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
                                            <button type="button" onClick={() => openReview(activeMediaType, activeEpisodeId, tabs.find(t => t.key === activeTab)?.label)}
                                                title="Review subtitle status and translations"
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

                    {/* ══ CAST MANAGEMENT ══ */}
                    {!isNew && (
                        <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
                            <SectionHeader id="cast" emoji="🎭" title={`Cast & Crew (${castMembers.length})`} />
                            {openSections.cast && (
                                <div style={{ paddingTop: 'var(--space-sm)' }}>
                                    {castLoading ? (
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Loading cast…</p>
                                    ) : (
                                        <>
                                            {castMembers.length === 0 && (
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)' }}>No cast members yet.</p>
                                            )}
                                            {castMembers.map(m => (
                                                <div key={m.id} style={{
                                                    display: 'flex', alignItems: 'center', gap: '10px',
                                                    padding: '8px 10px', borderRadius: 'var(--radius-md)',
                                                    background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)',
                                                    marginBottom: '6px',
                                                }}>
                                                    {m.photoUrl && (
                                                        <img src={m.photoUrl} alt={m.name}
                                                            style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                                                    )}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{m.name}</div>
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                                                            {m.jobTitle}{m.character ? ` — ${m.character}` : ''}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                                        <button type="button"
                                                            onClick={() => handleTranslateCastMember(m)}
                                                            disabled={translatingCastId === m.id}
                                                            style={{ fontSize: '0.65rem', padding: '4px 8px', borderRadius: '6px',
                                                                background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)',
                                                                color: '#818cf8', cursor: 'pointer' }}>
                                                            {translatingCastId === m.id ? '⏳' : '🌍 Translate'}
                                                        </button>
                                                        <button type="button"
                                                            onClick={() => handleDeleteCastMember(m.id)}
                                                            style={{ fontSize: '0.65rem', padding: '4px 8px', borderRadius: '6px',
                                                                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                                                                color: 'var(--error)', cursor: 'pointer' }}>
                                                            ✕
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Add cast member form */}
                                            <form onSubmit={handleAddCastMember} style={{ marginTop: 'var(--space-md)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                                                    Add Cast Member
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                    <input className="form-input" placeholder="Name *" value={castForm.name} onChange={e => setCastForm(f => ({ ...f, name: e.target.value }))} style={{ fontSize: '0.82rem' }} />
                                                    <select className="form-input" value={castForm.jobTitle} onChange={e => setCastForm(f => ({ ...f, jobTitle: e.target.value }))} style={{ fontSize: '0.82rem' }}>
                                                        {['Actor','Director','Producer','Writer','Composer','Cinematographer','Editor','Sound','VFX','Extra'].map(j => <option key={j} value={j}>{j}</option>)}
                                                    </select>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                                    <input className="form-input" placeholder="Character name" value={castForm.character} onChange={e => setCastForm(f => ({ ...f, character: e.target.value }))} style={{ fontSize: '0.82rem' }} />
                                                    <input className="form-input" placeholder="Photo URL" value={castForm.photoUrl} onChange={e => setCastForm(f => ({ ...f, photoUrl: e.target.value }))} style={{ fontSize: '0.82rem' }} />
                                                </div>
                                                <input className="form-input" placeholder="Instagram URL" value={castForm.instagramUrl} onChange={e => setCastForm(f => ({ ...f, instagramUrl: e.target.value }))} style={{ fontSize: '0.82rem' }} />
                                                <textarea className="form-input" rows={2} placeholder="Short bio (optional — supports auto-translation)" value={castForm.bio} onChange={e => setCastForm(f => ({ ...f, bio: e.target.value }))} style={{ fontSize: '0.82rem' }} />
                                                {castError && <p style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{castError}</p>}
                                                <button type="submit" disabled={castSaving} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
                                                    {castSaving ? 'Adding…' : '+ Add Member'}
                                                </button>
                                            </form>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ══ DANGER ZONE ══ */}
                    {!isNew && (
                        <div className="glass-card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)', border: '1px solid rgba(239,68,68,0.12)' }}>
                            <SectionHeader id="danger" emoji="⚠️" title="Danger Zone" />
                            {openSections.danger && (
                                <div style={{ paddingTop: 'var(--space-sm)' }}>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-md)', lineHeight: 1.6 }}>
                                        Permanently delete this project. All casting calls, applications, subtitles, and episode data will be removed. This cannot be undone.
                                    </p>
                                    <button
                                        type="button"
                                        disabled={isDeleting}
                                        onClick={handleDeleteProject}
                                        style={{
                                            fontSize: '0.82rem', fontWeight: 700, padding: '8px 18px',
                                            borderRadius: 'var(--radius-md)', cursor: isDeleting ? 'not-allowed' : 'pointer',
                                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                            color: 'var(--error)', opacity: isDeleting ? 0.6 : 1,
                                        }}
                                    >
                                        {isDeleting ? 'Deleting…' : `🗑 Delete "${form.title || 'Project'}"`}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

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

            {/* ── Subtitle Review modal ── */}
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
                                    🔍 {reviewMediaType === 'trailer' ? 'Trailer' : reviewMediaType === 'episode' ? (reviewEpisodeLabel || 'Episode') : 'Movie'} Subtitle Review
                                </h2>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    {form.title}
                                    <span style={{ padding: '1px 6px', marginLeft: '6px', fontSize: '0.6rem', fontWeight: 700, borderRadius: '4px', background: reviewMediaType === 'trailer' ? 'rgba(168,85,247,0.12)' : reviewMediaType === 'episode' ? 'rgba(52,211,153,0.12)' : 'rgba(59,130,246,0.12)', border: `1px solid ${reviewMediaType === 'trailer' ? 'rgba(168,85,247,0.3)' : reviewMediaType === 'episode' ? 'rgba(52,211,153,0.3)' : 'rgba(59,130,246,0.3)'}`, color: reviewMediaType === 'trailer' ? '#c084fc' : reviewMediaType === 'episode' ? '#34d399' : '#60a5fa' }}>
                                        {reviewMediaType === 'trailer' ? '🎬 Trailer' : reviewMediaType === 'episode' ? `📺 ${reviewEpisodeLabel || 'Episode'}` : '🎥 Movie'}
                                    </span>
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
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
                                    }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', flex: 1, minWidth: 0 }}>
                                            {reviewData.translateStatus === 'complete' ? '✅ All languages complete'
                                                : Object.keys(reviewData.translations).length > 0 ? `⚠️ ${Object.keys(reviewData.translations).length} of ${TOTAL_SUBTITLE_LANGS - 1} translations complete`
                                                : '📝 Source only — translations not yet generated'}
                                            {reviewData.generatedWith && ` · AI: ${reviewData.generatedWith}`}
                                        </span>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                            {/* Delete single translation track */}
                                            {reviewLang !== 'en' && reviewData.translations[reviewLang] && (
                                                <button
                                                    onClick={() => handleDeleteSubtitle('translation', reviewLang)}
                                                    style={{ fontSize: '0.62rem', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', transition: 'all 0.15s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.18)' }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                                                >
                                                    🗑 Delete {reviewLang.toUpperCase()} Track
                                                </button>
                                            )}
                                            {/* Delete entire subtitle record */}
                                            <button
                                                onClick={() => handleDeleteSubtitle('source')}
                                                style={{ fontSize: '0.62rem', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', cursor: 'pointer', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', transition: 'all 0.15s' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)' }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}
                                            >
                                                🗑 Delete All
                                            </button>
                                            <button onClick={closeReview} className="btn btn-ghost btn-sm">Close</button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>
                </div>
            )}
        </div>
    )
}
