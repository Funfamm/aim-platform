'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

/* ── Types ── */
type Lesson = {
    id?: string; title: string; contentType: string
    contentUrl: string; uploadPath: string; description: string
    duration: string; sortOrder: number
    completionThreshold?: number; minTimeSeconds?: string
}
type QuizQuestionType = {
    id?: string; questionText: string; questionType: string
    options: { id: string; text: string }[]
    correctAnswer: string; explanation: string; sourceRef: string
    sortOrder: number
}
type QuizType = {
    id?: string; title: string; passMark: number; maxAttempts: number
    questions: QuizQuestionType[]
}
type Module = {
    id?: string; title: string; description: string
    sortOrder: number; lessons: Lesson[]; quiz?: QuizType | null
}
type Course = {
    id: string; title: string; slug: string; description: string
    thumbnail: string | null; category: string; level: string
    published: boolean; sortOrder: number; translations: string | null
    modules: Module[]
}

const CATEGORIES = [
    { value: 'acting', label: '🎭 Acting', color: '#f59e0b' },
    { value: 'cinematography', label: '🎥 Cinematography', color: '#3b82f6' },
    { value: 'directing', label: '🎬 Directing', color: '#22c55e' },
    { value: 'writing', label: '✍️ Writing', color: '#ef4444' },
    { value: 'ai', label: '🤖 AI & Tech', color: '#a855f7' },
    { value: 'production', label: '🎙️ Production', color: '#06b6d4' },
    { value: 'vfx', label: '✨ VFX & Post', color: '#ec4899' },
]

const LEVELS = [
    { value: 'beginner', label: 'Beginner', color: '#22c55e' },
    { value: 'intermediate', label: 'Intermediate', color: '#f59e0b' },
    { value: 'advanced', label: 'Advanced', color: '#ef4444' },
    { value: 'all', label: 'All Levels', color: '#3b82f6' },
]

const CONTENT_TYPES = [
    { value: 'video', label: '🎥 Video' },
    { value: 'document', label: '📄 Document' },
    { value: 'audio', label: '🎧 Audio' },
    { value: 'slides', label: '📊 Slides' },
    { value: 'link', label: '🔗 External Link' },
]

const emptyLesson = (): Lesson => ({
    title: '', contentType: 'video', contentUrl: '', uploadPath: '',
    description: '', duration: '', sortOrder: 0,
    completionThreshold: 0.95, minTimeSeconds: '',
})

const emptyModule = (): Module => ({
    title: '', description: '', sortOrder: 0, lessons: [emptyLesson()], quiz: null,
})

const emptyQuestion = (): QuizQuestionType => ({
    questionText: '', questionType: 'single',
    options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }],
    correctAnswer: '', explanation: '', sourceRef: '', sortOrder: 0,
})

/* ── Selected Item State ── */
type Selection =
    | { type: 'course' }
    | { type: 'module'; moduleIndex: number }
    | { type: 'lesson'; moduleIndex: number; lessonIndex: number }
    | { type: 'quiz'; moduleIndex: number }
    | { type: 'analytics' }

export default function StudyCanvasPage() {
    const params = useParams()
    const router = useRouter()
    const courseId = params.id as string
    const isNew = courseId === 'new'

    // Course state
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [category, setCategory] = useState('acting')
    const [level, setLevel] = useState('beginner')
    const [thumbnail, setThumbnail] = useState('')
    const [published, setPublished] = useState(false)
    const [slug, setSlug] = useState('')
    const [modules, setModules] = useState<Module[]>([emptyModule()])
    const [sourceContent, setSourceContent] = useState('')
    const [generatingCourse, setGeneratingCourse] = useState(false)
    const [genProgress, setGenProgress] = useState('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [translations, setTranslations] = useState<Record<string, any> | null>(null)
    const [showTranslations, setShowTranslations] = useState(false)

    // UI state
    const [selection, setSelection] = useState<Selection>({ type: 'course' })
    const [saving, setSaving] = useState(false)
    const [saveProgress, setSaveProgress] = useState(0)
    const [saveStep, setSaveStep] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [loading, setLoading] = useState(!isNew)
    const [outlineCollapsed, setOutlineCollapsed] = useState(false)

    // Upload state
    const [uploading, setUploading] = useState<Record<string, boolean>>({})
    const [uploadStatus, setUploadStatus] = useState<Record<string, string>>({})

    // Analytics state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [analytics, setAnalytics] = useState<any>(null)
    const [analyticsLoading, setAnalyticsLoading] = useState(false)

    // Materials state: { moduleId: material[] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [moduleMaterials, setModuleMaterials] = useState<Record<string, any[]>>({})
    const [materialsLoading, setMaterialsLoading] = useState<Record<string, boolean>>({})
    const [materialUploading, setMaterialUploading] = useState(false)

    // AI generation state
    const [aiGenerating, setAiGenerating] = useState<string | null>(null) // 'lesson:0' or 'quiz:1' etc.

    // Load existing course
    useEffect(() => {
        if (!isNew) {
            fetch(`/api/admin/training/${courseId}`)
                .then(r => { if (r.status === 401) { router.push('/admin/login'); return null } return r.json() })
                .then(data => {
                    if (!data) return
                    setTitle(data.title); setDescription(data.description)
                    setCategory(data.category); setLevel(data.level)
                    if (data.sourceContent) setSourceContent(data.sourceContent)
                    if (data.slug) setSlug(data.slug)
                    setThumbnail(data.thumbnail || ''); setPublished(data.published)
                    if (data.translations) {
                        try { setTranslations(typeof data.translations === 'string' ? JSON.parse(data.translations) : data.translations) }
                        catch { setTranslations(null) }
                    }
                    setModules(data.modules?.length ? data.modules.map((m: Module & { translations?: string | null; quiz?: any }) => ({
                        ...m, description: m.description || '',
                        _translations: m.translations ? (typeof m.translations === 'string' ? JSON.parse(m.translations) : m.translations) : null,
                        lessons: m.lessons?.length ? m.lessons.map((l: Lesson & { translations?: string | null }) => ({
                            ...l, contentUrl: l.contentUrl || '', uploadPath: l.uploadPath || '',
                            description: l.description || '', duration: String(l.duration || ''),
                            _translations: l.translations ? (typeof l.translations === 'string' ? JSON.parse(l.translations) : l.translations) : null,
                        })) : [emptyLesson()],
                        quiz: m.quiz ? {
                            id: m.quiz.id,
                            title: m.quiz.title || '',
                            passMark: m.quiz.passMark ?? 80,
                            maxAttempts: m.quiz.maxAttempts ?? 1,
                            questions: (m.quiz.questions || []).map((q: any, qi: number) => ({
                                id: q.id,
                                questionText: q.questionText || '',
                                questionType: q.questionType || 'single',
                                options: typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []),
                                correctAnswer: q.correctAnswer || '',
                                explanation: q.explanation || '',
                                sourceRef: q.sourceRef || '',
                                sortOrder: q.sortOrder ?? qi,
                            })),
                        } : null,
                    })) : [emptyModule()])
                })
                .catch(() => setError('Failed to load course'))
                .finally(() => setLoading(false))
        }
    }, [courseId, isNew, router])

    // Auto-save debounce
    const handleSave = useCallback(async () => {
        if (!title.trim()) { setError('Course title is required'); return }
        setSaving(true); setError(''); setSuccess(''); setSaveProgress(0); setSaveStep('Saving course data...')
        try {
            const body = { title, description, category, level, thumbnail: thumbnail || null, published, modules, sourceContent: sourceContent || null }
            const url = isNew ? '/api/admin/training' : `/api/admin/training/${courseId}`
            const method = isNew ? 'POST' : 'PUT'
            const res = await fetch(url, {
                method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
            })
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}))
                throw new Error(errData.details || errData.error || 'Save failed')
            }

            // For PUT, read NDJSON stream for live progress
            if (method === 'PUT' && res.body) {
                const reader = res.body.getReader()
                const decoder = new TextDecoder()
                let buffer = ''
                let finalData = null

                while (true) {
                    const { done, value } = await reader.read()
                    if (done) break
                    buffer += decoder.decode(value, { stream: true })
                    const lines = buffer.split('\n')
                    buffer = lines.pop() || ''
                    for (const line of lines) {
                        if (!line.trim()) continue
                        try {
                            const event = JSON.parse(line)
                            if (event.type === 'progress') {
                                setSaveProgress(Math.round((event.done / event.total) * 100))
                                setSaveStep(event.step)
                            } else if (event.type === 'done') {
                                finalData = event.data
                                setSaveProgress(100)
                                setSaveStep('✅ All translations complete!')
                            }
                        } catch { /* skip malformed lines */ }
                    }
                }
                if (isNew && finalData?.id) {
                    router.replace(`/admin/training/${finalData.id}/edit`)
                }
            } else {
                // POST (new course) — normal JSON response
                const data = await res.json()
                if (isNew && data.id) {
                    router.replace(`/admin/training/${data.id}/edit`)
                }
            }
            setSuccess('Course saved & translated!')
            setTimeout(() => { setSuccess(''); setSaveProgress(0); setSaveStep('') }, 3000)
        } catch (e) { setError(e instanceof Error ? e.message : 'Failed to save course') }
        finally { setSaving(false) }
    }, [title, description, category, level, thumbnail, published, modules, sourceContent, isNew, courseId, router])

    // Module/lesson helpers
    const addModule = () => {
        setModules(prev => [...prev, emptyModule()])
        setSelection({ type: 'module', moduleIndex: modules.length })
    }
    const removeModule = (i: number) => {
        setModules(prev => prev.filter((_, idx) => idx !== i))
        setSelection({ type: 'course' })
    }
    const updateModule = (i: number, field: string, value: string) =>
        setModules(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m))
    const addLesson = (mi: number) => {
        setModules(prev => prev.map((m, idx) => idx === mi ? { ...m, lessons: [...m.lessons, emptyLesson()] } : m))
        setSelection({ type: 'lesson', moduleIndex: mi, lessonIndex: modules[mi].lessons.length })
    }
    const removeLesson = (mi: number, li: number) => {
        setModules(prev => prev.map((m, idx) => idx === mi ? { ...m, lessons: m.lessons.filter((_, j) => j !== li) } : m))
        setSelection({ type: 'module', moduleIndex: mi })
    }
    const updateLesson = (mi: number, li: number, field: string, value: string | number) =>
        setModules(prev => prev.map((m, idx) => idx === mi ? {
            ...m, lessons: m.lessons.map((l, j) => j === li ? { ...l, [field]: value } : l),
        } : m))

    // Reorder helpers
    const moveLesson = (mi: number, fromIndex: number, toIndex: number) => {
        if (toIndex < 0) return
        setModules(prev => prev.map((m, idx) => {
            if (idx !== mi) return m
            if (toIndex >= m.lessons.length) return m
            const lessons = [...m.lessons]
            const [moved] = lessons.splice(fromIndex, 1)
            lessons.splice(toIndex, 0, moved)
            return { ...m, lessons: lessons.map((l, i) => ({ ...l, sortOrder: i })) }
        }))
        setSelection({ type: 'lesson', moduleIndex: mi, lessonIndex: toIndex })
    }

    const moveModule = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= modules.length) return
        setModules(prev => {
            const copy = [...prev]
            const [moved] = copy.splice(fromIndex, 1)
            copy.splice(toIndex, 0, moved)
            return copy.map((m, i) => ({ ...m, sortOrder: i }))
        })
        setSelection({ type: 'module', moduleIndex: toIndex })
    }

    // Quiz helpers
    const addQuiz = (mi: number) => {
        setModules(prev => prev.map((m, idx) => idx === mi ? {
            ...m, quiz: { title: `${m.title || 'Module ' + (mi + 1)} Quiz`, passMark: 80, maxAttempts: 1, questions: [emptyQuestion()] }
        } : m))
        setSelection({ type: 'quiz', moduleIndex: mi })
    }
    const updateQuiz = (mi: number, field: string, value: string | number) =>
        setModules(prev => prev.map((m, idx) => idx === mi && m.quiz ? {
            ...m, quiz: { ...m.quiz, [field]: value }
        } : m))
    const addQuestion = (mi: number) =>
        setModules(prev => prev.map((m, idx) => idx === mi && m.quiz ? {
            ...m, quiz: { ...m.quiz, questions: [...m.quiz.questions, emptyQuestion()] }
        } : m))
    const updateQuestion = (mi: number, qi: number, field: string, value: string | number | { id: string; text: string }[]) =>
        setModules(prev => prev.map((m, idx) => idx === mi && m.quiz ? {
            ...m, quiz: { ...m.quiz, questions: m.quiz.questions.map((q, j) => j === qi ? { ...q, [field]: value } : q) }
        } : m))
    const removeQuestion = (mi: number, qi: number) =>
        setModules(prev => prev.map((m, idx) => idx === mi && m.quiz ? {
            ...m, quiz: { ...m.quiz, questions: m.quiz.questions.filter((_, j) => j !== qi) }
        } : m))
    const deleteQuiz = (mi: number) => {
        if (!confirm('Delete this quiz? Student attempts will be lost after saving.')) return
        setModules(prev => prev.map((m, idx) => idx === mi ? { ...m, quiz: null } : m))
        setSelection({ type: 'module', moduleIndex: mi })
    }

    // File upload
    const handleFileUpload = async (mi: number, li: number, file: File, contentType: string) => {
        const key = `${mi}-${li}`
        setUploading(prev => ({ ...prev, [key]: true }))
        setUploadStatus(prev => ({ ...prev, [key]: `Uploading ${file.name}...` }))
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('category', 'training')
            const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
            if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Upload failed') }
            const data = await res.json()
            updateLesson(mi, li, 'uploadPath', data.url)
            updateLesson(mi, li, 'contentUrl', data.url)
            setUploadStatus(prev => ({ ...prev, [key]: `✅ ${data.originalName}` }))
        } catch (err) {
            setUploadStatus(prev => ({ ...prev, [key]: `❌ ${err instanceof Error ? err.message : 'Upload failed'}` }))
        } finally {
            setUploading(prev => ({ ...prev, [key]: false }))
        }
    }

    const handleThumbnailUpload = async (file: File) => {
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('category', 'training-thumbnails')
            const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
            if (!res.ok) throw new Error('Upload failed')
            const data = await res.json()
            setThumbnail(data.url)
        } catch { setError('Thumbnail upload failed') }
    }

    // Materials helpers
    const loadMaterials = useCallback(async (moduleId: string) => {
        if (!moduleId || materialsLoading[moduleId]) return
        setMaterialsLoading(prev => ({ ...prev, [moduleId]: true }))
        try {
            const res = await fetch(`/api/admin/training/${courseId}/materials?moduleId=${moduleId}`)
            if (res.ok) {
                const data = await res.json()
                setModuleMaterials(prev => ({ ...prev, [moduleId]: data }))
            }
        } catch { /* silent */ }
        finally { setMaterialsLoading(prev => ({ ...prev, [moduleId]: false })) }
    }, [courseId, materialsLoading])

    const uploadMaterial = async (moduleId: string, file: File) => {
        setMaterialUploading(true)
        try {
            // First upload the file
            const formData = new FormData()
            formData.append('file', file)
            formData.append('category', 'training')
            const uploadRes = await fetch('/api/admin/upload', { method: 'POST', body: formData })
            if (!uploadRes.ok) throw new Error('Upload failed')
            const uploadData = await uploadRes.json()

            // Then create the material record
            const res = await fetch(`/api/admin/training/${courseId}/materials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    moduleId,
                    fileName: uploadData.originalName || file.name,
                    fileType: uploadData.type || 'document',
                    filePath: uploadData.url,
                    fileSize: uploadData.size || file.size,
                }),
            })
            if (res.ok) {
                loadMaterials(moduleId) // refresh list
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Material upload failed')
        } finally { setMaterialUploading(false) }
    }

    const deleteMaterial = async (moduleId: string, materialId: string) => {
        if (!confirm('Remove this material?')) return
        try {
            await fetch(`/api/admin/training/${courseId}/materials?materialId=${materialId}`, { method: 'DELETE' })
            setModuleMaterials(prev => ({
                ...prev,
                [moduleId]: (prev[moduleId] || []).filter((m: { id: string }) => m.id !== materialId),
            }))
        } catch { setError('Failed to delete material') }
    }

    const formatFileSize = (bytes: number) => {
        if (!bytes) return ''
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const getFileIcon = (type: string) => {
        switch (type) {
            case 'video': return '🎥'
            case 'image': return '🖼️'
            case 'audio': return '🎧'
            default: return '📄'
        }
    }

    const getAcceptTypes = (contentType: string) => {
        switch (contentType) {
            case 'video': return 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.avi'
            case 'document': return '.pdf,.doc,.docx,.txt,.md,.rtf'
            case 'slides': return '.ppt,.pptx,.pdf'
            case 'audio': return 'audio/mp3,audio/mpeg,audio/wav,.mp3,.wav,.ogg'
            default: return 'video/*,image/*,.pdf,.doc,.docx,.ppt,.pptx,.txt,.md'
        }
    }

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
            <div className="loading-spinner" />
        </div>
    )

    /* ── Right Panel Content Rendering ── */
    const renderRightPanel = () => {
        // Course Settings
        if (selection.type === 'course') {
            return (
                <div style={{ padding: '28px', maxWidth: '700px' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '24px', color: 'var(--text-primary)' }}>
                        📋 Course Settings
                    </h2>
                    <div style={{ display: 'grid', gap: '18px' }}>
                        <div>
                            <label style={labelStyle}>Title *</label>
                            <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)}
                                placeholder="e.g. Acting Fundamentals" />
                        </div>
                        <div>
                            <label style={labelStyle}>Description</label>
                            <textarea style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }} value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="What students will learn in this course..." />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <div>
                                <label style={labelStyle}>Category</label>
                                <select style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
                                    value={category} onChange={e => setCategory(e.target.value)}>
                                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Level</label>
                                <select style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
                                    value={level} onChange={e => setLevel(e.target.value)}>
                                    {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Thumbnail</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input style={{ ...inputStyle, flex: 1 }} value={thumbnail}
                                    onChange={e => setThumbnail(e.target.value)}
                                    placeholder="URL or upload an image" />
                                <label style={uploadBtnStyle}>
                                    📷 Upload
                                    <input type="file" accept="image/*" hidden
                                        onChange={e => { if (e.target.files?.[0]) handleThumbnailUpload(e.target.files[0]) }} />
                                </label>
                            </div>
                            {thumbnail && (
                                <div style={{ marginTop: '10px' }}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={thumbnail} alt="Thumbnail" style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }} />
                                </div>
                            )}
                        </div>
                        <div style={{
                            padding: '16px 20px', borderRadius: '12px',
                            background: published ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.02)',
                            border: `1px solid ${published ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.05)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                                    {published ? '🟢 Published' : '📝 Draft'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                                    {published ? 'Visible to students' : 'Hidden from the public'}
                                </div>
                            </div>
                            <button onClick={() => setPublished(!published)} style={{
                                padding: '8px 18px', fontSize: '0.8rem', fontWeight: 700,
                                border: 'none', borderRadius: '10px', cursor: 'pointer',
                                background: published ? 'rgba(239,68,68,0.1)' : 'rgba(52,211,153,0.1)',
                                color: published ? '#ef4444' : '#34d399',
                            }}>{published ? 'Unpublish' : 'Publish'}</button>
                        </div>
                        {/* ── AI Course Generation ── */}
                        <div style={{
                            padding: '20px', borderRadius: '14px',
                            background: 'linear-gradient(135deg, rgba(168,85,247,0.04), rgba(59,130,246,0.04))',
                            border: '1px dashed rgba(168,85,247,0.2)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                                <span style={{ fontSize: '1.3rem' }}>🤖</span>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#a855f7' }}>AI Course Generator</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                                        Paste your course material → AI structures it into modules, lessons & quiz
                                    </div>
                                </div>
                            </div>
                            <textarea
                                style={{
                                    ...inputStyle, minHeight: '180px', resize: 'vertical',
                                    fontFamily: 'inherit', fontSize: '0.82rem', lineHeight: 1.6,
                                    background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(168,85,247,0.15)',
                                }}
                                value={sourceContent}
                                onChange={e => setSourceContent(e.target.value)}
                                placeholder={`Paste your full course content here...\n\nThe AI will analyze this text and create:\n• Up to 4 modules\n• Up to 4 lessons per module\n• A final quiz covering all modules\n\nAll content will be auto-translated to 10+ languages.`}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                                <button
                                    disabled={generatingCourse || !sourceContent.trim() || sourceContent.trim().length < 50}
                                    onClick={async () => {
                                        setGeneratingCourse(true)
                                        setGenProgress('🔍 Analyzing content...')
                                        setError('')
                                        try {
                                            // If this is a new (unsaved) course, save it first to get a real ID
                                            let realCourseId = courseId
                                            if (isNew) {
                                                if (!title.trim()) { setError('Please enter a course title first'); setGeneratingCourse(false); setGenProgress(''); return }
                                                setGenProgress('💾 Saving course first...')
                                                const saveRes = await fetch('/api/admin/training', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ title, description, category, level, thumbnail: thumbnail || null, published, modules, sourceContent: sourceContent || null }),
                                                })
                                                if (!saveRes.ok) throw new Error('Failed to save course before generating')
                                                const saved = await saveRes.json()
                                                realCourseId = saved.id
                                                // Update the URL without full reload so subsequent saves use the real ID
                                                window.history.replaceState(null, '', `/admin/training/${realCourseId}/edit`)
                                            }
                                            setGenProgress('🧠 AI is structuring your course...')
                                            const res = await fetch(`/api/admin/training/${realCourseId}/generate`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    type: 'full_course',
                                                    sourceContent,
                                                    courseTitle: title,
                                                    courseCategory: category,
                                                    courseLevel: level,
                                                }),
                                            })
                                            if (!res.ok) {
                                                const err = await res.json()
                                                throw new Error(err.error || 'Generation failed')
                                            }
                                            const { data } = await res.json()
                                            setGenProgress('📚 Building modules & lessons...')

                                            // Update description if AI provided one
                                            if (data.courseDescription) setDescription(data.courseDescription)

                                            // Build modules from AI output
                                            const newModules: Module[] = (data.modules || []).map((mod: any, mi: number) => ({
                                                title: mod.title || `Module ${mi + 1}`,
                                                description: mod.description || '',
                                                sortOrder: mi,
                                                lessons: (mod.lessons || []).map((les: any, li: number) => ({
                                                    title: les.title || `Lesson ${li + 1}`,
                                                    contentType: les.contentType || 'document',
                                                    contentUrl: '',
                                                    uploadPath: '',
                                                    description: les.content || les.description || '',
                                                    duration: String(Math.min(parseInt(les.duration) || 15, 15)),
                                                    sortOrder: li,
                                                    completionThreshold: 0.95,
                                                    minTimeSeconds: '',
                                                })),
                                                quiz: null as QuizType | null,
                                            }))

                                            // Add final quiz to the last module
                                            if (data.finalQuiz && newModules.length > 0) {
                                                const lastIdx = newModules.length - 1
                                                newModules[lastIdx].quiz = {
                                                    title: data.finalQuiz.title || 'Final Assessment',
                                                    passMark: data.finalQuiz.passMark || 70,
                                                    maxAttempts: 3,
                                                    questions: (data.finalQuiz.questions || []).map((q: any, qi: number) => ({
                                                        questionText: q.questionText || '',
                                                        questionType: q.questionType || 'multiple_choice',
                                                        options: q.options || [],
                                                        correctAnswer: q.correctAnswer || '',
                                                        explanation: q.explanation || '',
                                                        sourceRef: '',
                                                        sortOrder: qi,
                                                    })),
                                                }
                                            }

                                            setModules(newModules)
                                            setGenProgress('')
                                            setSuccess(`✨ Course generated! ${newModules.length} modules, ${newModules.reduce((s, m) => s + m.lessons.length, 0)} lessons, ${data.finalQuiz?.questions?.length || 0} quiz questions. Click Save to persist.`)
                                            setTimeout(() => setSuccess(''), 8000)
                                        } catch (err) {
                                            setError(err instanceof Error ? err.message : 'AI generation failed')
                                        } finally {
                                            setGeneratingCourse(false)
                                            setGenProgress('')
                                        }
                                    }}
                                    style={{
                                        padding: '10px 24px', fontSize: '0.85rem', fontWeight: 700,
                                        border: 'none', borderRadius: '10px', cursor: generatingCourse ? 'wait' : 'pointer',
                                        background: generatingCourse ? 'rgba(168,85,247,0.15)' : 'linear-gradient(135deg, #a855f7, #6366f1)',
                                        color: '#fff', opacity: (!sourceContent.trim() || sourceContent.trim().length < 50) ? 0.4 : 1,
                                        transition: 'all 0.2s',
                                    }}
                                >
                                    {generatingCourse ? '⏳ Generating...' : '🤖 Generate Full Course'}
                                </button>
                                {sourceContent.trim().length > 0 && sourceContent.trim().length < 50 && (
                                    <span style={{ fontSize: '0.72rem', color: '#f59e0b' }}>
                                        Need at least 50 characters
                                    </span>
                                )}
                            </div>
                            {genProgress && (
                                <div style={{
                                    marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
                                    background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.1)',
                                    fontSize: '0.8rem', color: '#a855f7', fontWeight: 600,
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                }}>
                                    {genProgress}
                                </div>
                            )}
                        </div>

                        {/* Translation Status */}
                        <div style={{
                            padding: '16px 20px', borderRadius: '12px',
                            background: 'rgba(59,130,246,0.03)', border: '1px solid rgba(59,130,246,0.08)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '1rem' }}>🌐</span>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Auto Translation</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '1px' }}>
                                            {translations ? `Translated to ${Object.keys(translations).length} languages` : 'Will translate on save'}
                                        </div>
                                    </div>
                                </div>
                                {translations && (
                                    <button onClick={() => setShowTranslations(!showTranslations)} style={{
                                        padding: '5px 12px', fontSize: '0.72rem', fontWeight: 600,
                                        border: '1px solid rgba(59,130,246,0.15)', borderRadius: '8px',
                                        cursor: 'pointer', background: 'transparent', color: '#3b82f6',
                                    }}>{showTranslations ? 'Hide' : 'Preview'}</button>
                                )}
                            </div>
                            {showTranslations && translations && (
                                <div style={{ marginTop: '12px', display: 'grid', gap: '8px' }}>
                                    {Object.entries(translations).map(([locale, fields]) => (
                                        <div key={locale} style={{
                                            padding: '8px 12px', borderRadius: '8px',
                                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                                        }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', color: '#3b82f6', letterSpacing: '0.05em' }}>{locale}</span>
                                            {typeof fields === 'object' && fields && Object.entries(fields as Record<string, string>).map(([key, val]) => (
                                                <div key={key} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.65rem' }}>{key}: </span>{val}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )
        }

        // Module Editor
        if (selection.type === 'module') {
            const mi = selection.moduleIndex
            const mod = modules[mi]
            if (!mod) return null
            return (
                <div style={{ padding: '28px', maxWidth: '700px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                        <span style={{
                            fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: '8px',
                            background: 'rgba(168,85,247,0.1)', color: '#a855f7',
                        }}>M{mi + 1}</span>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Module Settings
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gap: '18px' }}>
                        <div>
                            <label style={labelStyle}>Module Title *</label>
                            <input style={inputStyle} value={mod.title}
                                onChange={e => updateModule(mi, 'title', e.target.value)}
                                placeholder="e.g. Introduction to Stage Presence" />
                        </div>
                        <div>
                            <label style={labelStyle}>Objective / Description</label>
                            <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                                value={mod.description}
                                onChange={e => updateModule(mi, 'description', e.target.value)}
                                placeholder="What students will learn in this module..." />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button onClick={() => addLesson(mi)} style={{
                                padding: '8px 18px', fontSize: '0.8rem', fontWeight: 600,
                                border: '1px dashed rgba(59,130,246,0.3)', borderRadius: '10px',
                                cursor: 'pointer', background: 'rgba(59,130,246,0.06)', color: '#3b82f6',
                            }}>+ Add Lesson</button>
                            {!mod.quiz ? (
                                <button onClick={() => addQuiz(mi)} style={{
                                    padding: '8px 18px', fontSize: '0.8rem', fontWeight: 600,
                                    border: '1px dashed rgba(245,158,11,0.3)', borderRadius: '10px',
                                    cursor: 'pointer', background: 'rgba(245,158,11,0.06)', color: '#f59e0b',
                                }}>+ Add Quiz</button>
                            ) : (
                                <button onClick={() => deleteQuiz(mi)} style={{
                                    padding: '8px 18px', fontSize: '0.8rem', fontWeight: 600,
                                    border: '1px dashed rgba(239,68,68,0.3)', borderRadius: '10px',
                                    cursor: 'pointer', background: 'rgba(239,68,68,0.06)', color: '#ef4444',
                                }}>🗑️ Delete Quiz</button>
                            )}
                            <button
                                disabled={!!aiGenerating}
                                onClick={async () => {
                                    const genKey = `lesson:${mi}`
                                    setAiGenerating(genKey)
                                    try {
                                        const res = await fetch(`/api/admin/training/${courseId}/generate`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                type: 'lesson_content',
                                                moduleTitle: mod.title,
                                                moduleDescription: mod.description,
                                                existingLessons: mod.lessons.map(l => l.title),
                                            }),
                                        })
                                        if (res.ok) {
                                            const { data } = await res.json()
                                            const newLesson: Lesson = {
                                                title: data.title || 'AI Generated Lesson',
                                                contentType: 'reading',
                                                contentUrl: '', uploadPath: '',
                                                description: data.content || data.description || '',
                                                duration: String(data.estimatedDuration || 10),
                                                sortOrder: mod.lessons.length,
                                            }
                                            setModules(prev => {
                                                const copy = [...prev]
                                                copy[mi] = { ...copy[mi], lessons: [...copy[mi].lessons, newLesson] }
                                                return copy
                                            })
                                            setSuccess('✨ AI lesson generated!')
                                            setTimeout(() => setSuccess(''), 3000)
                                        } else {
                                            const err = await res.json()
                                            setError(err.error || 'AI generation failed')
                                        }
                                    } catch { setError('AI generation failed') }
                                    finally { setAiGenerating(null) }
                                }}
                                style={{
                                    padding: '8px 18px', fontSize: '0.8rem', fontWeight: 600,
                                    border: '1px dashed rgba(168,85,247,0.3)', borderRadius: '10px',
                                    cursor: aiGenerating ? 'wait' : 'pointer',
                                    background: 'rgba(168,85,247,0.06)', color: '#a855f7',
                                    opacity: aiGenerating ? 0.6 : 1,
                                }}
                            >{aiGenerating === `lesson:${mi}` ? '⏳ Generating...' : '🤖 AI Lesson'}</button>
                            <button
                                disabled={!!aiGenerating}
                                onClick={async () => {
                                    const genKey = `quiz:${mi}`
                                    setAiGenerating(genKey)
                                    try {
                                        const res = await fetch(`/api/admin/training/${courseId}/generate`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                type: 'quiz',
                                                moduleTitle: mod.title,
                                                moduleDescription: mod.description,
                                                existingLessons: mod.lessons.map(l => l.title),
                                                questionCount: 5,
                                            }),
                                        })
                                        if (res.ok) {
                                            const { data } = await res.json()
                                            const quiz: QuizType = {
                                                title: data.title || `Quiz: ${mod.title}`,
                                                passMark: data.passMark || 70,
                                                maxAttempts: 3,
                                                questions: (data.questions || []).map((q: any, qi: number) => ({
                                                    questionText: q.questionText,
                                                    questionType: q.questionType || 'multiple_choice',
                                                    options: q.options || [],
                                                    correctAnswer: q.correctAnswer || '',
                                                    explanation: q.explanation || '',
                                                    sourceRef: '',
                                                    sortOrder: qi,
                                                })),
                                            }
                                            setModules(prev => {
                                                const copy = [...prev]
                                                copy[mi] = { ...copy[mi], quiz }
                                                return copy
                                            })
                                            setSuccess(mod.quiz ? '🔄 Quiz regenerated!' : '✨ AI quiz generated!')
                                            setTimeout(() => setSuccess(''), 3000)
                                        } else {
                                            const err = await res.json()
                                            setError(err.error || 'Quiz generation failed')
                                        }
                                    } catch { setError('Quiz generation failed') }
                                    finally { setAiGenerating(null) }
                                }}
                                style={{
                                    padding: '8px 18px', fontSize: '0.8rem', fontWeight: 600,
                                    border: `1px dashed ${mod.quiz ? 'rgba(59,130,246,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: '10px',
                                    cursor: aiGenerating ? 'wait' : 'pointer',
                                    background: mod.quiz ? 'rgba(59,130,246,0.06)' : 'rgba(245,158,11,0.06)',
                                    color: mod.quiz ? '#3b82f6' : '#f59e0b',
                                    opacity: aiGenerating ? 0.6 : 1,
                                }}
                            >{aiGenerating === `quiz:${mi}` ? '⏳ Generating...' : (mod.quiz ? '🔄 Regenerate Quiz' : '🤖 AI Quiz')}</button>
                        </div>
                        {/* Materials Section */}
                        <div style={{
                            padding: '16px', borderRadius: '12px',
                            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>📎 Materials</span>
                                <label style={{
                                    padding: '5px 12px', fontSize: '0.7rem', fontWeight: 600,
                                    border: '1px dashed rgba(52,211,153,0.3)', borderRadius: '8px',
                                    cursor: materialUploading ? 'wait' : 'pointer',
                                    background: 'rgba(52,211,153,0.06)', color: '#34d399',
                                    opacity: materialUploading ? 0.6 : 1,
                                }}>
                                    {materialUploading ? '⏳ Uploading...' : '📁 Upload File'}
                                    <input type="file" hidden disabled={materialUploading || !mod.id}
                                        accept="video/*,image/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv,.xls,.xlsx"
                                        onChange={e => { if (e.target.files?.[0] && mod.id) uploadMaterial(mod.id, e.target.files[0]) }} />
                                </label>
                            </div>
                            {!mod.id && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', padding: '8px 0' }}>
                                    Save the course first to enable material uploads.
                                </div>
                            )}
                            {mod.id && (() => {
                                const materials = moduleMaterials[mod.id]
                                const isLoading = materialsLoading[mod.id]
                                if (!materials && !isLoading) {
                                    loadMaterials(mod.id)
                                }
                                if (isLoading) return <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', padding: '8px 0' }}>Loading materials...</div>
                                if (!materials?.length) return <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', padding: '8px 0' }}>No materials uploaded yet.</div>
                                return (
                                    <div style={{ display: 'grid', gap: '6px' }}>
                                        {materials.map((mat: any) => (
                                            <div key={mat.id} style={{
                                                display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px',
                                                borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)',
                                            }}>
                                                <span style={{ fontSize: '1rem' }}>{getFileIcon(mat.fileType)}</span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {mat.fileName}
                                                    </div>
                                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                                                        {mat.fileType} {mat.fileSize ? `• ${formatFileSize(mat.fileSize)}` : ''}
                                                    </div>
                                                </div>
                                                <a href={mat.filePath} target="_blank" rel="noopener noreferrer" style={{
                                                    padding: '3px 8px', fontSize: '0.6rem', fontWeight: 600,
                                                    border: '1px solid rgba(59,130,246,0.15)', borderRadius: '6px',
                                                    textDecoration: 'none', color: '#3b82f6',
                                                }}>View</a>
                                                <button onClick={() => deleteMaterial(mod.id!, mat.id)} style={{
                                                    padding: '3px 8px', fontSize: '0.65rem', border: 'none',
                                                    cursor: 'pointer', background: 'transparent', color: 'rgba(239,68,68,0.5)',
                                                }}>✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })()}
                        </div>
                        {/* Module Translation Status */}
                        {(mod as any)._translations && (
                            <div style={{
                                padding: '10px 14px', borderRadius: '10px',
                                background: 'rgba(59,130,246,0.03)', border: '1px solid rgba(59,130,246,0.08)',
                                fontSize: '0.72rem', color: 'var(--text-tertiary)',
                                display: 'flex', alignItems: 'center', gap: '6px',
                            }}>
                                🌐 Translated to {Object.keys((mod as any)._translations).length} languages
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>Auto-updated on save</span>
                            </div>
                        )}
                        {modules.length > 1 && (
                            <button onClick={() => removeModule(mi)} style={{
                                padding: '8px 18px', fontSize: '0.8rem', fontWeight: 600,
                                border: 'none', borderRadius: '10px', cursor: 'pointer',
                                background: 'rgba(239,68,68,0.06)', color: '#ef4444',
                            }}>🗑️ Remove Module</button>
                        )}
                    </div>
                </div>
            )
        }

        // Lesson Editor
        if (selection.type === 'lesson') {
            const { moduleIndex: mi, lessonIndex: li } = selection
            const lesson = modules[mi]?.lessons[li]
            if (!lesson) return null
            const uploadKey = `${mi}-${li}`
            const isUploading = uploading[uploadKey]
            const status = uploadStatus[uploadKey]
            return (
                <div style={{ padding: '28px', maxWidth: '700px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                        <span style={{
                            fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                            background: 'rgba(59,130,246,0.1)', color: '#3b82f6',
                        }}>M{mi + 1} · L{li + 1}</span>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Lesson Editor
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gap: '16px' }}>
                        <div>
                            <label style={labelStyle}>Lesson Title *</label>
                            <input style={inputStyle} value={lesson.title}
                                onChange={e => updateLesson(mi, li, 'title', e.target.value)}
                                placeholder="e.g. Watch: Stage Presence Basics" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '14px' }}>
                            <div>
                                <label style={labelStyle}>Content Type</label>
                                <select style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
                                    value={lesson.contentType}
                                    onChange={e => updateLesson(mi, li, 'contentType', e.target.value)}>
                                    {CONTENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Duration (min)</label>
                                <input style={inputStyle} value={lesson.duration} type="number"
                                    onChange={e => updateLesson(mi, li, 'duration', e.target.value)}
                                    placeholder="Min" />
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Content URL or Upload</label>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input style={{ ...inputStyle, flex: 1 }} value={lesson.contentUrl}
                                    onChange={e => updateLesson(mi, li, 'contentUrl', e.target.value)}
                                    placeholder={lesson.contentType === 'video' ? 'YouTube URL or upload' : 'URL or upload a file'} />
                                {['video', 'document', 'audio', 'slides'].includes(lesson.contentType) && (
                                    <label style={{
                                        ...uploadBtnStyle,
                                        opacity: isUploading ? 0.6 : 1,
                                        cursor: isUploading ? 'wait' : 'pointer',
                                    }}>
                                        {isUploading ? '⏳ ...' : '📁 Upload'}
                                        <input type="file" accept={getAcceptTypes(lesson.contentType)} hidden
                                            disabled={isUploading}
                                            onChange={e => { if (e.target.files?.[0]) handleFileUpload(mi, li, e.target.files[0], lesson.contentType) }} />
                                    </label>
                                )}
                            </div>
                        </div>
                        {status && (
                            <div style={{
                                fontSize: '0.75rem', padding: '6px 12px', borderRadius: '8px',
                                background: status.startsWith('✅') ? 'rgba(52,211,153,0.08)' : status.startsWith('❌') ? 'rgba(239,68,68,0.08)' : 'rgba(59,130,246,0.08)',
                                color: status.startsWith('✅') ? '#34d399' : status.startsWith('❌') ? '#ef4444' : '#3b82f6',
                            }}>{status}</div>
                        )}
                        {lesson.uploadPath && (
                            <div style={{
                                fontSize: '0.75rem', padding: '6px 12px', borderRadius: '8px',
                                background: 'rgba(212,168,83,0.06)', color: 'var(--accent-gold)',
                                display: 'flex', alignItems: 'center', gap: '8px',
                            }}>
                                📎 <span style={{ opacity: 0.8 }}>{lesson.uploadPath.split('/').pop()}</span>
                                <button onClick={() => { updateLesson(mi, li, 'uploadPath', ''); updateLesson(mi, li, 'contentUrl', '') }} style={{
                                    marginLeft: 'auto', padding: '0 6px', fontSize: '0.7rem', border: 'none',
                                    cursor: 'pointer', background: 'transparent', color: 'rgba(239,68,68,0.5)',
                                }}>✕</button>
                            </div>
                        )}
                        {/* Transcript Generation */}
                        {lesson.contentType === 'video' && lesson.uploadPath && (
                            <div style={{
                                padding: '14px 18px', borderRadius: '12px',
                                background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.1)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#a855f7', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        📝 Transcript & Subtitles
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <button
                                        onClick={async () => {
                                            if (!lesson.id) return
                                            try {
                                                const { transcribeVideo } = await import('@/lib/transcribe-client')
                                                const result = await transcribeVideo(
                                                    lesson.uploadPath!,
                                                    (status, detail) => {
                                                        const statusMap: Record<string, string> = {
                                                            'loading-ffmpeg': '⏳ Loading video engine...',
                                                            'extracting-audio': '🎵 Extracting audio...',
                                                            'loading-model': '🤖 Loading AI model (~244MB first time)...',
                                                            'transcribing': '📝 Transcribing (this may take a while)...',
                                                            'done': '✅ Transcript generated!',
                                                            'error': `❌ ${detail || 'Failed'}`,
                                                        }
                                                        setUploadStatus(prev => ({ ...prev, [uploadKey]: statusMap[status] || `⏳ ${detail}` }))
                                                    },
                                                )

                                                // Save transcript + subtitles to DB
                                                await fetch('/api/admin/training/transcript', {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({
                                                        lessonId: lesson.id,
                                                        segments: result.segments,
                                                    }),
                                                })

                                                setUploadStatus(prev => ({ ...prev, [uploadKey]: '✅ Transcript & subtitles saved!' }))
                                            } catch (err) {
                                                setUploadStatus(prev => ({ ...prev, [uploadKey]: `❌ ${err instanceof Error ? err.message : 'Transcription failed'}` }))
                                            }
                                        }}
                                        disabled={!lesson.id}
                                        style={{
                                            padding: '8px 16px', fontSize: '0.75rem', fontWeight: 600,
                                            borderRadius: '8px', border: 'none', cursor: lesson.id ? 'pointer' : 'not-allowed',
                                            background: 'rgba(168,85,247,0.15)', color: '#a855f7',
                                            opacity: lesson.id ? 1 : 0.5,
                                        }}
                                    >
                                        {lesson.id ? '🎙️ Generate Transcript' : 'Save course first'}
                                    </button>
                                    {/* Optional SRT download — only after transcript exists */}
                                    <button
                                        onClick={async () => {
                                            if (!lesson.id) return
                                            try {
                                                const res = await fetch(`/api/admin/training/transcript?lessonId=${lesson.id}`)
                                                const data = await res.json()
                                                if (!data.segments) { alert('No transcript found. Generate one first.'); return }
                                                const segments = typeof data.segments === 'string' ? JSON.parse(data.segments) : data.segments
                                                const { segmentsToSRT, downloadFile } = await import('@/lib/transcribe-client')
                                                const srt = segmentsToSRT(segments)
                                                downloadFile(srt, `${lesson.title || 'transcript'}.srt`, 'text/srt')
                                            } catch { alert('No transcript found. Generate one first.') }
                                        }}
                                        disabled={!lesson.id}
                                        style={{
                                            padding: '8px 16px', fontSize: '0.75rem', fontWeight: 600,
                                            borderRadius: '8px', border: 'none', cursor: lesson.id ? 'pointer' : 'not-allowed',
                                            background: 'rgba(59,130,246,0.12)', color: '#3b82f6',
                                            opacity: lesson.id ? 1 : 0.5,
                                        }}
                                    >
                                        📥 Download SRT
                                    </button>
                                </div>
                                <div style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)', marginTop: '6px', lineHeight: 1.5 }}>
                                    Transcript auto-saves to DB & shows as subtitles on the video player.
                                    <br />Download SRT for YouTube, Premiere Pro, or other video tools.
                                </div>
                            </div>
                        )}
                        {/* Preview */}
                        {lesson.contentUrl && lesson.contentType === 'video' && lesson.contentUrl.includes('youtu') && (
                            <div>
                                <label style={labelStyle}>Preview</label>
                                <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <iframe
                                        width="100%" height="280"
                                        src={`https://www.youtube.com/embed/${extractYouTubeId(lesson.contentUrl)}`}
                                        style={{ border: 'none' }}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                            </div>
                        )}
                        <div>
                            <label style={labelStyle}>Description</label>
                            <textarea style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                                value={lesson.description}
                                onChange={e => updateLesson(mi, li, 'description', e.target.value)}
                                placeholder="Optional description..." />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <div>
                                <label style={labelStyle}>Completion Threshold</label>
                                <input style={inputStyle} type="number" step="0.05" min="0" max="1"
                                    value={lesson.completionThreshold ?? 0.95}
                                    onChange={e => updateLesson(mi, li, 'completionThreshold', parseFloat(e.target.value) || 0.95)}
                                    placeholder="0.95" />
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                    For video: % watched to complete (0.95 = 95%)
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Min Time (seconds)</label>
                                <input style={inputStyle} type="number"
                                    value={lesson.minTimeSeconds || ''}
                                    onChange={e => updateLesson(mi, li, 'minTimeSeconds', e.target.value)}
                                    placeholder="Auto" />
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                                    Min reading/viewing time to complete
                                </div>
                            </div>
                        </div>
                        {/* Lesson Translation Status */}
                        {(lesson as any)._translations && (
                            <div style={{
                                padding: '10px 14px', borderRadius: '10px',
                                background: 'rgba(59,130,246,0.03)', border: '1px solid rgba(59,130,246,0.08)',
                                fontSize: '0.72rem', color: 'var(--text-tertiary)',
                                display: 'flex', alignItems: 'center', gap: '6px',
                            }}>
                                🌐 Translated to {Object.keys((lesson as any)._translations).length} languages
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>Auto-updated on save</span>
                            </div>
                        )}
                        {modules[mi].lessons.length > 1 && (
                            <button onClick={() => removeLesson(mi, li)} style={{
                                padding: '8px 18px', fontSize: '0.8rem', fontWeight: 600,
                                border: 'none', borderRadius: '10px', cursor: 'pointer',
                                background: 'rgba(239,68,68,0.06)', color: '#ef4444',
                            }}>🗑️ Remove Lesson</button>
                        )}
                    </div>
                </div>
            )
        }

        // Quiz Editor
        if (selection.type === 'quiz') {
            const mi = selection.moduleIndex
            const quiz = modules[mi]?.quiz
            if (!quiz) return null
            return (
                <div style={{ padding: '28px', maxWidth: '750px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                        <span style={{
                            fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                            background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
                        }}>M{mi + 1} · Quiz</span>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            Quiz Editor
                        </h2>
                    </div>
                    <div style={{ display: 'grid', gap: '18px' }}>
                        <div>
                            <label style={labelStyle}>Quiz Title</label>
                            <input style={inputStyle} value={quiz.title}
                                onChange={e => updateQuiz(mi, 'title', e.target.value)}
                                placeholder="Module Quiz" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <div>
                                <label style={labelStyle}>Pass Mark (%)</label>
                                <input style={inputStyle} type="number" value={quiz.passMark}
                                    onChange={e => updateQuiz(mi, 'passMark', parseInt(e.target.value) || 80)} />
                            </div>
                            <div>
                                <label style={labelStyle}>Max Attempts</label>
                                <input style={inputStyle} type="number" value={quiz.maxAttempts}
                                    onChange={e => updateQuiz(mi, 'maxAttempts', parseInt(e.target.value) || 1)} />
                            </div>
                        </div>

                        {/* Questions */}
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '18px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                <label style={{ ...labelStyle, marginBottom: 0 }}>Questions ({quiz.questions.length})</label>
                                <button onClick={() => addQuestion(mi)} style={{
                                    padding: '5px 14px', fontSize: '0.75rem', fontWeight: 600,
                                    border: '1px dashed rgba(245,158,11,0.3)', borderRadius: '8px',
                                    cursor: 'pointer', background: 'rgba(245,158,11,0.06)', color: '#f59e0b',
                                }}>+ Add Question</button>
                            </div>
                            {quiz.questions.map((q, qi) => (
                                <div key={qi} style={{
                                    marginBottom: '14px', padding: '16px', borderRadius: '10px',
                                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b' }}>Q{qi + 1}</span>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <select style={{ ...inputStyle, padding: '4px 8px', fontSize: '0.72rem', width: 'auto' }}
                                                value={q.questionType}
                                                onChange={e => updateQuestion(mi, qi, 'questionType', e.target.value)}>
                                                <option value="single">Single Choice</option>
                                                <option value="multiple">Multiple Choice</option>
                                                <option value="truefalse">True/False</option>
                                            </select>
                                            {quiz.questions.length > 1 && (
                                                <button onClick={() => removeQuestion(mi, qi)} style={{
                                                    padding: '2px 8px', fontSize: '0.7rem', border: 'none',
                                                    cursor: 'pointer', background: 'transparent', color: 'rgba(239,68,68,0.5)',
                                                }}>✕</button>
                                            )}
                                        </div>
                                    </div>
                                    <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical', marginBottom: '10px' }}
                                        value={q.questionText}
                                        onChange={e => updateQuestion(mi, qi, 'questionText', e.target.value)}
                                        placeholder="Enter question text..." />
                                    {q.questionType === 'truefalse' ? (
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            {['True', 'False'].map(opt => (
                                                <button key={opt} onClick={() => updateQuestion(mi, qi, 'correctAnswer', opt.toLowerCase())}
                                                    style={{
                                                        flex: 1, padding: '10px', fontSize: '0.85rem', fontWeight: 600,
                                                        borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s',
                                                        border: q.correctAnswer === opt.toLowerCase() ? '2px solid #34d399' : '1px solid rgba(255,255,255,0.06)',
                                                        background: q.correctAnswer === opt.toLowerCase() ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.02)',
                                                        color: q.correctAnswer === opt.toLowerCase() ? '#34d399' : 'var(--text-secondary)',
                                                    }}>{opt}</button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gap: '6px' }}>
                                            {q.options.map((opt, oi) => (
                                                <div key={opt.id} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <button onClick={() => updateQuestion(mi, qi, 'correctAnswer', opt.id)}
                                                        style={{
                                                            width: '28px', height: '28px', borderRadius: '50%', border: 'none',
                                                            cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center',
                                                            justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700,
                                                            background: q.correctAnswer === opt.id ? '#34d399' : 'rgba(255,255,255,0.06)',
                                                            color: q.correctAnswer === opt.id ? '#0a0a0a' : 'var(--text-tertiary)',
                                                            transition: 'all 0.2s',
                                                        }}>{opt.id.toUpperCase()}</button>
                                                    <input style={{ ...inputStyle, flex: 1, fontSize: '0.82rem' }}
                                                        value={opt.text}
                                                        onChange={e => {
                                                            const newOpts = [...q.options]
                                                            newOpts[oi] = { ...newOpts[oi], text: e.target.value }
                                                            updateQuestion(mi, qi, 'options', newOpts)
                                                        }}
                                                        placeholder={`Option ${opt.id.toUpperCase()}`} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div style={{ marginTop: '10px' }}>
                                        <input style={{ ...inputStyle, fontSize: '0.75rem' }}
                                            value={q.explanation}
                                            onChange={e => updateQuestion(mi, qi, 'explanation', e.target.value)}
                                            placeholder="Admin-only explanation (why this is correct)" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )
        }

        // Analytics Dashboard
        if (selection.type === 'analytics') {
            // Load analytics on selection
            if (!analytics && !analyticsLoading && !isNew) {
                setAnalyticsLoading(true)
                fetch(`/api/admin/training/${courseId}/analytics`)
                    .then(r => r.json())
                    .then(data => setAnalytics(data))
                    .catch(() => setAnalytics(null))
                    .finally(() => setAnalyticsLoading(false))
            }

            if (analyticsLoading) return (
                <div style={{ padding: '28px', textAlign: 'center' }}>
                    <div className="loading-spinner" style={{ margin: '40px auto' }} />
                    <p style={{ color: 'var(--text-tertiary)' }}>Loading analytics...</p>
                </div>
            )

            if (!analytics?.overview) return (
                <div style={{ padding: '28px', maxWidth: '800px' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '24px', color: 'var(--text-primary)' }}>
                        📊 Course Analytics
                    </h2>
                    <div style={{
                        padding: '40px', textAlign: 'center', borderRadius: '12px',
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                        color: 'var(--text-tertiary)',
                    }}>
                        <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📊</div>
                        <p>No enrollment data yet. Analytics will appear once students enroll.</p>
                    </div>
                </div>
            )

            const ov = analytics.overview
            return (
                <div style={{ padding: '28px', maxWidth: '900px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                            📊 Course Analytics
                        </h2>
                        <button onClick={() => { setAnalytics(null); setAnalyticsLoading(false) }} style={{
                            padding: '6px 14px', fontSize: '0.75rem', fontWeight: 600,
                            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
                            cursor: 'pointer', background: 'transparent', color: 'var(--text-tertiary)',
                        }}>🔄 Refresh</button>
                    </div>

                    {/* Overview Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                        {[
                            { label: 'Total Enrolled', value: ov.totalEnrollments, icon: '👥', color: '#3b82f6' },
                            { label: 'Active', value: ov.activeEnrollments, icon: '🟢', color: '#34d399' },
                            { label: 'Completed', value: ov.completedEnrollments, icon: '🏆', color: '#f59e0b' },
                            { label: 'Completion Rate', value: `${ov.completionRate}%`, icon: '📈', color: '#a855f7' },
                        ].map(stat => (
                            <div key={stat.label} style={{
                                padding: '16px', borderRadius: '12px',
                                background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                                textAlign: 'center',
                            }}>
                                <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>{stat.icon}</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>{stat.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Trend Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Last 7 Days</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#3b82f6' }}>+{ov.enrollmentsLast7}</div>
                        </div>
                        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(168,85,247,0.04)', border: '1px solid rgba(168,85,247,0.1)' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Last 30 Days</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#a855f7' }}>+{ov.enrollmentsLast30}</div>
                        </div>
                        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Modules</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{ov.totalModules}</div>
                        </div>
                        <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Lessons</div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{ov.totalLessons}</div>
                        </div>
                    </div>

                    {/* Per-Module Stats */}
                    {analytics.moduleStats?.length > 0 && (
                        <div style={{ marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px' }}>📦 Module Progress</h3>
                            {analytics.moduleStats.map((mod: any, i: number) => (
                                <div key={mod.id || i} style={{
                                    padding: '14px 16px', borderRadius: '10px', marginBottom: '8px',
                                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>M{i + 1}</span>
                                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{mod.title || `Module ${i + 1}`}</span>
                                        </div>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{mod.studentsReached} students • {mod.lessonCount} lessons</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${mod.completionRate}%`, borderRadius: '3px', background: 'linear-gradient(90deg, #3b82f6, #a855f7)', transition: 'width 0.5s' }} />
                                        </div>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#a855f7', minWidth: '35px' }}>{mod.completionRate}%</span>
                                    </div>
                                    {mod.quizStats && (
                                        <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                            <span>📝 {mod.quizStats.totalAttempts} attempts</span>
                                            <span>✅ {mod.quizStats.passRate}% pass rate</span>
                                            <span>📊 Avg: {mod.quizStats.avgScore}%</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Student Engagement Table */}
                    {analytics.studentEngagement?.length > 0 && (
                        <div>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '12px' }}>👥 Student Engagement</h3>
                            <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontSize: '0.6rem', letterSpacing: '0.05em' }}>Student</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontSize: '0.6rem' }}>Progress</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontSize: '0.6rem' }}>Mode</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontSize: '0.6rem' }}>Reviews</th>
                                            <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontSize: '0.6rem' }}>Last Active</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.studentEngagement.map((s: any, i: number) => (
                                            <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <div style={{ fontWeight: 600 }}>{s.user.name || s.user.email}</div>
                                                    {s.user.name && <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>{s.user.email}</div>}
                                                </td>
                                                <td style={{ padding: '10px 14px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                                                        <div style={{ width: '60px', height: '5px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${s.progressPercent}%`, borderRadius: '3px', background: s.completedAt ? '#34d399' : '#3b82f6' }} />
                                                        </div>
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: s.completedAt ? '#34d399' : 'var(--text-secondary)' }}>
                                                            {s.lessonsCompleted}/{s.totalLessons}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                    <span style={{
                                                        fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                                                        background: s.mode === 'review' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
                                                        color: s.mode === 'review' ? '#f59e0b' : '#3b82f6',
                                                        textTransform: 'uppercase',
                                                    }}>{s.mode || 'learning'}</span>
                                                </td>
                                                <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                                    {s.reviewActivities}
                                                </td>
                                                <td style={{ padding: '10px 14px', textAlign: 'right', color: 'var(--text-tertiary)', fontSize: '0.72rem' }}>
                                                    {new Date(s.lastActivity).toLocaleDateString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )
        }

        return null
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
            background: 'var(--bg-primary)', color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
        }}>
            {/* ── Top Toolbar ── */}
            <div style={{
                height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(12px)',
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <Link href="/admin/training" style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        color: 'var(--text-tertiary)', fontSize: '0.82rem', fontWeight: 600,
                        textDecoration: 'none', transition: 'color 0.2s',
                    }}>
                        ← Back
                    </Link>
                    <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.08)' }} />
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {title || 'Untitled Course'}
                    </div>
                    <span style={{
                        fontSize: '0.6rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
                        background: published ? 'rgba(52,211,153,0.1)' : 'rgba(239,68,68,0.08)',
                        color: published ? '#34d399' : '#ef4444', textTransform: 'uppercase',
                    }}>{published ? 'PUBLISHED' : 'DRAFT'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {error && (
                        <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 600 }}>⚠️ {error}</span>
                    )}
                    {success && (
                        <span style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600 }}>✅ {success}</span>
                    )}
                    {!isNew && (
                        <a href={`/en/training/${slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}?preview=admin`} target="_blank" rel="noopener noreferrer" style={{
                            padding: '8px 18px', fontSize: '0.82rem', fontWeight: 700,
                            border: '1px solid rgba(168,85,247,0.3)', borderRadius: '10px',
                            cursor: 'pointer', textDecoration: 'none',
                            background: 'rgba(168,85,247,0.1)', color: '#a855f7',
                            transition: 'all 0.2s',
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                            👁️ Preview as Student
                        </a>
                    )}
                    <button onClick={handleSave} disabled={saving} style={{
                        padding: '8px 22px', fontSize: '0.82rem', fontWeight: 700,
                        border: 'none', borderRadius: '10px', cursor: 'pointer',
                        background: 'var(--accent-gold)', color: '#0a0a0a',
                        opacity: saving ? 0.7 : 1, transition: 'all 0.2s',
                    }}>
                        {saving ? '⏳ Saving...' : '💾 Save'}
                    </button>
                </div>
            </div>

            {/* ── Translation Progress Bar ── */}
            {saving && saveStep && (
                <div style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(135deg, rgba(212,168,83,0.06), rgba(168,85,247,0.04))',
                    borderBottom: '1px solid rgba(212,168,83,0.1)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            🌐 {saveStep}
                        </div>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: saveProgress >= 100 ? '#22c55e' : 'var(--accent-gold)' }}>
                            {saveProgress}%
                        </div>
                    </div>
                    <div style={{
                        height: '6px', borderRadius: '3px',
                        background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
                        position: 'relative',
                    }}>
                        <div style={{
                            width: `${saveProgress}%`,
                            height: '100%', borderRadius: '3px',
                            background: saveProgress >= 100
                                ? 'linear-gradient(90deg, #22c55e, #34d399)'
                                : 'linear-gradient(90deg, var(--accent-gold), #f59e0b, #a855f7)',
                            transition: 'width 0.4s ease, background 0.3s ease',
                            position: 'relative',
                        }}>
                            {saveProgress < 100 && (
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                                    animation: 'shimmer 1.5s infinite',
                                }} />
                            )}
                        </div>
                    </div>
                    <style>{`@keyframes shimmer { 0% { transform: translateX(-100%) } 100% { transform: translateX(100%) } }`}</style>
                </div>
            )}

            {/* ── Main Split Panel ── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* ── Left: Outline Tree ── */}
                <div style={{
                    width: outlineCollapsed ? '48px' : '300px',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.01)',
                    display: 'flex', flexDirection: 'column',
                    transition: 'width 0.3s ease',
                    overflow: 'hidden', flexShrink: 0,
                }}>
                    {/* Collapse toggle */}
                    <div style={{
                        padding: outlineCollapsed ? '12px 8px' : '12px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        display: 'flex', justifyContent: outlineCollapsed ? 'center' : 'space-between',
                        alignItems: 'center',
                    }}>
                        {!outlineCollapsed && (
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}>
                                Outline
                            </span>
                        )}
                        <button onClick={() => setOutlineCollapsed(!outlineCollapsed)} style={{
                            padding: '4px 8px', fontSize: '0.8rem', border: 'none', borderRadius: '6px',
                            cursor: 'pointer', background: 'transparent', color: 'var(--text-tertiary)',
                        }}>{outlineCollapsed ? '▶' : '◀'}</button>
                    </div>

                    {!outlineCollapsed && (
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                            {/* Course root */}
                            <button onClick={() => setSelection({ type: 'course' })} style={{
                                width: '100%', padding: '8px 16px', fontSize: '0.8rem', fontWeight: 600,
                                border: 'none', cursor: 'pointer', textAlign: 'left',
                                background: selection.type === 'course' ? 'rgba(212,168,83,0.08)' : 'transparent',
                                color: selection.type === 'course' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                borderLeft: selection.type === 'course' ? '3px solid var(--accent-gold)' : '3px solid transparent',
                                transition: 'all 0.15s',
                            }}>📋 Course Settings</button>

                            {/* Modules */}
                            {modules.map((mod, mi) => (
                                <div key={mi}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <button onClick={() => setSelection({ type: 'module', moduleIndex: mi })} style={{
                                            flex: 1, padding: '8px 16px', fontSize: '0.78rem', fontWeight: 600,
                                            border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex',
                                            alignItems: 'center', gap: '6px',
                                            background: selection.type === 'module' && selection.moduleIndex === mi ? 'rgba(168,85,247,0.06)' : 'transparent',
                                            color: selection.type === 'module' && selection.moduleIndex === mi ? '#a855f7' : 'var(--text-secondary)',
                                            borderLeft: selection.type === 'module' && selection.moduleIndex === mi ? '3px solid #a855f7' : '3px solid transparent',
                                            transition: 'all 0.15s',
                                        }}>
                                            <span style={{
                                                fontSize: '0.55rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px',
                                                background: 'rgba(168,85,247,0.1)', color: '#a855f7',
                                            }}>M{mi + 1}</span>
                                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {mod.title || `Module ${mi + 1}`}
                                            </span>
                                        </button>
                                        {modules.length > 1 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', marginRight: '4px' }}>
                                                <button onClick={(e) => { e.stopPropagation(); moveModule(mi, mi - 1) }} disabled={mi === 0}
                                                    style={{ border: 'none', background: 'transparent', cursor: mi === 0 ? 'default' : 'pointer', color: mi === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-tertiary)', fontSize: '0.55rem', padding: '0 3px', lineHeight: 1 }}>▲</button>
                                                <button onClick={(e) => { e.stopPropagation(); moveModule(mi, mi + 1) }} disabled={mi === modules.length - 1}
                                                    style={{ border: 'none', background: 'transparent', cursor: mi === modules.length - 1 ? 'default' : 'pointer', color: mi === modules.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-tertiary)', fontSize: '0.55rem', padding: '0 3px', lineHeight: 1 }}>▼</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Lessons */}
                                    {mod.lessons.map((lesson, li) => (
                                        <div key={li} style={{ display: 'flex', alignItems: 'center' }}>
                                            <button
                                                onClick={() => setSelection({ type: 'lesson', moduleIndex: mi, lessonIndex: li })}
                                                style={{
                                                    flex: 1, padding: '6px 16px 6px 36px', fontSize: '0.72rem',
                                                    border: 'none', cursor: 'pointer', textAlign: 'left',
                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                    background: selection.type === 'lesson' && selection.moduleIndex === mi && selection.lessonIndex === li
                                                        ? 'rgba(59,130,246,0.06)' : 'transparent',
                                                    color: selection.type === 'lesson' && selection.moduleIndex === mi && selection.lessonIndex === li
                                                        ? '#3b82f6' : 'var(--text-tertiary)',
                                                    borderLeft: selection.type === 'lesson' && selection.moduleIndex === mi && selection.lessonIndex === li
                                                        ? '3px solid #3b82f6' : '3px solid transparent',
                                                    transition: 'all 0.15s',
                                                }}>
                                                <span style={{ fontSize: '0.65rem' }}>
                                                    {lesson.contentType === 'video' ? '🎥' : lesson.contentType === 'audio' ? '🎧' : lesson.contentType === 'slides' ? '📊' : '📄'}
                                                </span>
                                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {lesson.title || `Lesson ${li + 1}`}
                                                </span>
                                            </button>
                                            {mod.lessons.length > 1 && (
                                                <div style={{ display: 'flex', flexDirection: 'column', marginRight: '4px' }}>
                                                    <button onClick={(e) => { e.stopPropagation(); moveLesson(mi, li, li - 1) }} disabled={li === 0}
                                                        style={{ border: 'none', background: 'transparent', cursor: li === 0 ? 'default' : 'pointer', color: li === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-tertiary)', fontSize: '0.5rem', padding: '0 3px', lineHeight: 1 }}>▲</button>
                                                    <button onClick={(e) => { e.stopPropagation(); moveLesson(mi, li, li + 1) }} disabled={li === mod.lessons.length - 1}
                                                        style={{ border: 'none', background: 'transparent', cursor: li === mod.lessons.length - 1 ? 'default' : 'pointer', color: li === mod.lessons.length - 1 ? 'rgba(255,255,255,0.1)' : 'var(--text-tertiary)', fontSize: '0.5rem', padding: '0 3px', lineHeight: 1 }}>▼</button>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {/* Quiz */}
                                    {mod.quiz && (
                                        <button onClick={() => setSelection({ type: 'quiz', moduleIndex: mi })} style={{
                                            width: '100%', padding: '6px 16px 6px 36px', fontSize: '0.72rem',
                                            border: 'none', cursor: 'pointer', textAlign: 'left',
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            background: selection.type === 'quiz' && selection.moduleIndex === mi
                                                ? 'rgba(245,158,11,0.06)' : 'transparent',
                                            color: selection.type === 'quiz' && selection.moduleIndex === mi
                                                ? '#f59e0b' : 'var(--text-tertiary)',
                                            borderLeft: selection.type === 'quiz' && selection.moduleIndex === mi
                                                ? '3px solid #f59e0b' : '3px solid transparent',
                                            transition: 'all 0.15s',
                                        }}>
                                            <span style={{ fontSize: '0.65rem' }}>📝</span>
                                            <span>Quiz ({mod.quiz.questions.length} Qs)</span>
                                        </button>
                                    )}
                                </div>
                            ))}

                            {/* Add module button */}
                            <button onClick={addModule} style={{
                                width: '100%', padding: '10px 16px', fontSize: '0.75rem', fontWeight: 600,
                                border: 'none', cursor: 'pointer', textAlign: 'left',
                                background: 'transparent', color: '#a855f7',
                                borderLeft: '3px solid transparent',
                                marginTop: '4px',
                            }}>+ Add Module</button>

                            {/* Analytics */}
                            {!isNew && (
                                <button onClick={() => setSelection({ type: 'analytics' })} style={{
                                    width: '100%', padding: '8px 16px', fontSize: '0.78rem', fontWeight: 600,
                                    border: 'none', cursor: 'pointer', textAlign: 'left',
                                    background: selection.type === 'analytics' ? 'rgba(6,182,212,0.06)' : 'transparent',
                                    color: selection.type === 'analytics' ? '#06b6d4' : 'var(--text-secondary)',
                                    borderLeft: selection.type === 'analytics' ? '3px solid #06b6d4' : '3px solid transparent',
                                    transition: 'all 0.15s', marginTop: '8px',
                                    borderTop: '1px solid rgba(255,255,255,0.04)',
                                    paddingTop: '12px',
                                }}>📊 Analytics</button>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Right: Editor Panel ── */}
                <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }}>
                    {renderRightPanel()}
                </div>
            </div>
        </div>
    )
}

/* ── Shared Styles ── */
const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'var(--text-tertiary)', marginBottom: '6px',
}

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', fontSize: '0.85rem',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px', color: 'var(--text-primary)', outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit',
}

const uploadBtnStyle: React.CSSProperties = {
    padding: '8px 16px', fontSize: '0.78rem', fontWeight: 600,
    border: '1px solid rgba(212,168,83,0.2)', borderRadius: '10px',
    cursor: 'pointer', background: 'rgba(212,168,83,0.08)', color: 'var(--accent-gold)',
    whiteSpace: 'nowrap',
}

function extractYouTubeId(url: string): string {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
    return match ? match[1] : ''
}
