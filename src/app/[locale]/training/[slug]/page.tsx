'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Footer from '@/components/Footer'
import { useTranslations, useLocale } from 'next-intl'

type Lesson = { id: string; title: string; contentType: string; contentUrl: string | null; uploadPath: string | null; description: string | null; duration: number | null; sortOrder: number; translations: string | null }
type Module = { id: string; title: string; description: string | null; sortOrder: number; lessons: Lesson[]; translations: string | null }
type Course = {
    id: string; title: string; slug: string; description: string; thumbnail: string | null
    category: string; level: string; modules: Module[]; translations: string | null
    _count: { enrollments: number }
}
type ProgressEntry = { lessonId: string; completed: boolean }
type Badge = { badgeType: string; earnedAt: string }
type QuizQuestion = { id: string; questionText: string; questionType: string; options: { id: string; text: string }[]; translations: string | null }
type QuizData = { id: string; title: string; passMark: number; maxAttempts: number; questionCount: number; translations: string | null; questions: QuizQuestion[] }
type QuizAttemptResult = { id: string; score: number; passed: boolean; attemptNumber: number; createdAt: string }

const BADGE_ICONS: Record<string, string> = {
    first_lesson: '🌟', first_course: '🎓', streak_7: '🔥',
    streak_30: '⚡', completionist: '🏆', top_performer: '👑',
}
const BADGE_KEYS: Record<string, { label: string; desc: string }> = {
    first_lesson: { label: 'badgeFirstLesson', desc: 'badgeFirstLessonDesc' },
    first_course: { label: 'badgeGraduate', desc: 'badgeGraduateDesc' },
    streak_7: { label: 'badgeStreak7', desc: 'badgeStreak7Desc' },
    streak_30: { label: 'badgeStreak30', desc: 'badgeStreak30Desc' },
    completionist: { label: 'badgeCompletionist', desc: 'badgeCompletionistDesc' },
    top_performer: { label: 'badgeTopPerformer', desc: 'badgeTopPerformerDesc' },
}

const CAT_ICONS: Record<string, string> = {
    acting: '🎭', cinematography: '🎥', directing: '🎬', writing: '✍️',
    ai: '🤖', production: '🎙️', vfx: '✨',
}

/* ── Full Scrollable Transcript with Sliding Eye-Trace Box ── */
function FullTranscript({ segments, currentTime, isRtl }: {
    segments: { start: number; end: number; text: string }[]
    currentTime: number
    isRtl: boolean
}) {
    const containerRef = useRef<HTMLDivElement>(null)
    const boxRef = useRef<HTMLDivElement>(null)
    const lastAutoScrollTime = useRef(0)

    // Punctuation regex — word ends with one of these
    const PUNCT = /[.,:;!?…。،؛؟]+$/

    // Build flat word list with time ranges, and group into phrases (punctuation-to-punctuation)
    const { allWords, phrases } = useMemo(() => {
        const words: { word: string; start: number; end: number; phraseIdx: number }[] = []
        const phr: { startIdx: number; endIdx: number; startTime: number; endTime: number }[] = []
        let phraseStart = 0
        let phraseStartTime = 0

        for (let si = 0; si < segments.length; si++) {
            const seg = segments[si]
            const segWords = seg.text.split(/\s+/).filter(Boolean)
            if (segWords.length === 0) continue
            const wordDuration = (seg.end - seg.start) / segWords.length

            for (let wi = 0; wi < segWords.length; wi++) {
                const wStart = seg.start + wi * wordDuration
                const wEnd = seg.start + (wi + 1) * wordDuration
                const globalIdx = words.length

                if (globalIdx === 0) {
                    phraseStart = 0
                    phraseStartTime = wStart
                }

                words.push({ word: segWords[wi], start: wStart, end: wEnd, phraseIdx: phr.length })

                // End phrase at punctuation or end of segment
                const isLastWordInSeg = wi === segWords.length - 1
                const hasPunct = PUNCT.test(segWords[wi])

                if (hasPunct || isLastWordInSeg) {
                    phr.push({
                        startIdx: phraseStart,
                        endIdx: globalIdx,
                        startTime: phraseStartTime,
                        endTime: wEnd,
                    })
                    // Update phraseIdx for all words in this phrase
                    for (let k = phraseStart; k <= globalIdx; k++) {
                        words[k].phraseIdx = phr.length - 1
                    }
                    phraseStart = globalIdx + 1
                    phraseStartTime = wEnd
                }
            }
        }

        // Handle trailing words without punctuation
        if (phraseStart < words.length) {
            const pIdx = phr.length
            phr.push({
                startIdx: phraseStart,
                endIdx: words.length - 1,
                startTime: phraseStartTime,
                endTime: words[words.length - 1].end,
            })
            for (let k = phraseStart; k < words.length; k++) {
                words[k].phraseIdx = pIdx
            }
        }

        return { allWords: words, phrases: phr }
    }, [segments])

    // Find active phrase based on current time
    const activePhraseIdx = useMemo(() => {
        for (let i = 0; i < phrases.length; i++) {
            if (currentTime >= phrases[i].startTime && currentTime < phrases[i].endTime) return i
        }
        for (let i = 0; i < phrases.length; i++) {
            if (currentTime < phrases[i].startTime) return Math.max(0, i - 1)
        }
        return phrases.length - 1
    }, [currentTime, phrases])

    // Position the sliding box over the active phrase
    useEffect(() => {
        if (!containerRef.current || !boxRef.current || activePhraseIdx < 0 || phrases.length === 0) return
        const phrase = phrases[activePhraseIdx]
        if (!phrase) return

        const firstEl = containerRef.current.querySelector<HTMLSpanElement>(`[data-wi="${phrase.startIdx}"]`)
        const lastEl = containerRef.current.querySelector<HTMLSpanElement>(`[data-wi="${phrase.endIdx}"]`)
        if (!firstEl || !lastEl) return

        const containerRect = containerRef.current.getBoundingClientRect()
        const firstRect = firstEl.getBoundingClientRect()
        const lastRect = lastEl.getBoundingClientRect()

        // Check if phrase spans multiple lines
        const singleLine = Math.abs(firstRect.top - lastRect.top) < 4

        if (singleLine) {
            const left = Math.min(firstRect.left, lastRect.left) - containerRect.left + containerRef.current.scrollLeft
            const right = Math.max(firstRect.right, lastRect.right) - containerRect.left + containerRef.current.scrollLeft
            const top = firstRect.top - containerRect.top + containerRef.current.scrollTop

            boxRef.current.style.top = `${top - 1}px`
            boxRef.current.style.left = `${left - 3}px`
            boxRef.current.style.width = `${right - left + 6}px`
            boxRef.current.style.height = `${firstRect.height + 2}px`
        } else {
            // Multi-line: just highlight the first word to keep box simple
            const top = firstRect.top - containerRect.top + containerRef.current.scrollTop
            const left = firstRect.left - containerRect.left + containerRef.current.scrollLeft

            boxRef.current.style.top = `${top - 1}px`
            boxRef.current.style.left = `${left - 3}px`
            boxRef.current.style.width = `${lastRect.right - firstRect.left + 6}px`
            boxRef.current.style.height = `${lastRect.bottom - firstRect.top + 2}px`
        }

        // Auto-scroll to keep active phrase visible
        const now = Date.now()
        if (now - lastAutoScrollTime.current > 400) {
            lastAutoScrollTime.current = now
            const wordRelativeTop = firstRect.top - containerRect.top
            const containerHeight = containerRect.height
            if (wordRelativeTop < 10 || wordRelativeTop > containerHeight - 40) {
                firstEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }
    }, [activePhraseIdx, phrases])

    return (
        <div
            ref={containerRef}
            dir={isRtl ? 'rtl' : 'ltr'}
            style={{
                padding: '12px 16px',
                background: 'rgba(0,0,0,0.65)',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                maxHeight: '180px',
                overflowY: 'auto',
                backdropFilter: 'blur(8px)',
                position: 'relative',
                fontSize: '0.82rem',
                lineHeight: 1.8,
            }}
        >
            {/* Sliding phrase highlight box */}
            <div
                ref={boxRef}
                style={{
                    position: 'absolute',
                    background: 'rgba(212,168,83,0.15)',
                    border: '1px solid rgba(212,168,83,0.3)',
                    borderRadius: '3px',
                    transition: 'top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease',
                    pointerEvents: 'none',
                    zIndex: 2,
                }}
            />
            {/* All words as continuous flow */}
            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '3px 4px',
                justifyContent: isRtl ? 'flex-end' : 'flex-start',
                flexDirection: isRtl ? 'row-reverse' : 'row',
            }}>
                {allWords.map((w, i) => {
                    const isPast = w.phraseIdx < activePhraseIdx
                    const isActive = w.phraseIdx === activePhraseIdx
                    return (
                        <span
                            key={i}
                            data-wi={i}
                            style={{
                                padding: '1px 3px',
                                transition: 'color 0.2s ease',
                                color: isActive ? '#fde68a' : isPast ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.7)',
                                fontWeight: isActive ? 600 : 400,
                                position: 'relative',
                                zIndex: 1,
                            }}
                        >
                            {w.word}
                        </span>
                    )
                })}
            </div>
        </div>
    )
}


export default function CourseDetailPage() {
    const t = useTranslations('training')
    const locale = useLocale()
    const params = useParams()
    const searchParams = useSearchParams()
    const slug = params?.slug as string

    // Admin preview mode — bypasses enrollment & locks
    // Initialise optimistically from URL so there's no flash of locked content
    const [isAdminPreview, setIsAdminPreview] = useState(() =>
        typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'admin'
    )
    useEffect(() => {
        if (searchParams?.get('preview') === 'admin') {
            // Verify the user is actually an admin (roles stored lowercase in DB)
            fetch('/api/auth/me').then(r => r.json()).then(data => {
                const isAdmin = data.user && ['admin', 'superadmin'].includes(data.user.role)
                setIsAdminPreview(isAdmin)
            }).catch(() => setIsAdminPreview(false))
        } else {
            setIsAdminPreview(false)
        }
    }, [searchParams])

    // Helper to get translated field from translations JSON
    const tr = (translations: string | null, field: string, fallback: string) => {
        if (!translations || locale === 'en') return fallback
        try {
            const parsed = typeof translations === 'string' ? JSON.parse(translations) : translations
            return parsed?.[locale]?.[field] || fallback
        } catch { return fallback }
    }

    const [course, setCourse] = useState<Course | null>(null)
    const [loading, setLoading] = useState(true)
    const [enrolled, setEnrolled] = useState(false)
    const [progress, setProgress] = useState<ProgressEntry[]>([])
    const [xp, setXp] = useState(0)
    const [streak, setStreak] = useState(0)
    const [badges, setBadges] = useState<Badge[]>([])
    const [expandedModule, setExpandedModule] = useState(0)
    const [activeLesson, setActiveLesson] = useState<Lesson | null>(null)
    const [completing, setCompleting] = useState(false)
    const [readingProgress, setReadingProgress] = useState(0)
    const readingTimerRef = useRef<NodeJS.Timeout | null>(null)
    const ytPlayerRef = useRef<any>(null)
    const videoRef = useRef<HTMLVideoElement | null>(null)
    const videoCompletedRef = useRef(false)
    const [enrolling, setEnrolling] = useState(false)

    // Transcript / subtitle state
    type TranscriptSegment = { start: number; end: number; text: string }
    const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([])
    const [transcriptTranslations, setTranscriptTranslations] = useState<Record<string, TranscriptSegment[]> | null>(null)
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1)
    const [videoCurrentTime, setVideoCurrentTime] = useState(0)
    const subtitleRafRef = useRef<number | null>(null)

    // Quiz state
    const [quizData, setQuizData] = useState<QuizData | null>(null)
    const [quizAttempts, setQuizAttempts] = useState<QuizAttemptResult[]>([])
    const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({})
    const [quizSubmitting, setQuizSubmitting] = useState(false)
    const [quizLoading, setQuizLoading] = useState(false)
    const [quizError, setQuizError] = useState<string | null>(null)
    const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean; correctCount: number; totalQuestions: number; xpGained: number } | null>(null)
    const [activeQuizModuleId, setActiveQuizModuleId] = useState<string | null>(null)
    const [retakeGated, setRetakeGated] = useState(false)
    const [reviewsNeeded, setReviewsNeeded] = useState(0)
    const [reviewsDone, setReviewsDone] = useState(0)

    // Review mode state
    const [enrollmentMode, setEnrollmentMode] = useState<string>('learning')

    // Confetti & toasts
    const [showConfetti, setShowConfetti] = useState(false)
    const [toasts, setToasts] = useState<{ id: number; text: string; color: string }[]>([])

    let toastCounter = 0
    const addToast = (text: string, color = '#d4a853') => {
        const id = Date.now() * 100 + (toastCounter++ % 100)
        setToasts(prev => [...prev, { id, text, color }])
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
    }

    const triggerConfetti = () => {
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 3000)
    }

    const loadProgress = useCallback(async (courseId: string) => {
        try {
            const r = await fetch(`/api/training/${courseId}/progress`)
            const data = await r.json()
            setEnrolled(data.enrolled)
            setProgress(data.progress || [])
            setXp(data.xp || 0)
            setStreak(data.streak || 0)
            setBadges(data.badges || [])
            if (data.enrollment?.mode) setEnrollmentMode(data.enrollment.mode)
        } catch { /* not logged in */ }
    }, [])

    useEffect(() => {
        if (!slug) return
        fetch('/api/training')
            .then(r => r.json())
            .then((courses: Course[]) => {
                const found = courses.find(c => c.slug === slug)
                if (found) {
                    setCourse(found)
                    loadProgress(found.id)
                    if (found.modules[0]?.lessons[0]) {
                        setActiveLesson(found.modules[0].lessons[0])
                    }
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false))
    }, [slug, loadProgress])

    // Fetch transcript whenever activeLesson changes (fixes refresh issue)
    useEffect(() => {
        if (!activeLesson || activeLesson.contentType !== 'video') return
        setTranscriptSegments([])
        setTranscriptTranslations(null)
        setCurrentSegmentIndex(-1)
        fetch(`/api/training/transcript?lessonId=${activeLesson.id}`)
            .then(r => r.json())
            .then(data => {
                if (data.transcript) {
                    const segs = data.transcript.segments || []
                    setTranscriptSegments(segs)
                    setTranscriptTranslations(data.transcript.translations || null)
                }
            }).catch(() => { /* no transcript */ })
    }, [activeLesson?.id])

    const handleEnroll = async () => {
        if (!course || enrolling) return
        setEnrolling(true)
        try {
            const r = await fetch(`/api/training/${course.id}/progress`, { method: 'POST' })
            if (r.ok) {
                setEnrolled(true)
                addToast(`🎉 ${t('enrolled')}`, '#22c55e')
                triggerConfetti()
                // Auto-open first lesson after enrollment
                if (course.modules[0]?.lessons[0]) {
                    setActiveLesson(course.modules[0].lessons[0])
                    setExpandedModule(0)
                }
            } else {
                const data = await r.json()
                if (data.error === 'Unauthorized') {
                    window.location.href = `/${locale}/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`
                }
            }
        } catch { addToast('Failed to enroll', '#ef4444') }
        finally { setEnrolling(false) }
    }

    // Sequential locking: check if a lesson is locked
    const isLessonLocked = (moduleIndex: number, lessonIndex: number): boolean => {
        if (isAdminPreview) return false
        if (!enrolled || !course) return false
        // First lesson of first module is always unlocked
        if (moduleIndex === 0 && lessonIndex === 0) return false
        // Check previous lesson in same module
        if (lessonIndex > 0) {
            const prevLesson = course.modules[moduleIndex].lessons[lessonIndex - 1]
            return !isCompleted(prevLesson.id)
        }
        // First lesson of a later module: check if all lessons of previous module are complete
        if (moduleIndex > 0) {
            const prevModule = course.modules[moduleIndex - 1]
            return !prevModule.lessons.every(l => isCompleted(l.id))
        }
        return false
    }

    // Clean up reading timer on unmount or lesson change
    useEffect(() => {
        return () => {
            if (readingTimerRef.current) clearInterval(readingTimerRef.current)
        }
    }, [activeLesson])

    // Start reading timer for non-video lessons when selected
    useEffect(() => {
        if (!activeLesson || !enrolled || isCompleted(activeLesson.id)) return
        if (activeLesson.contentType === 'video') return // videos use onEnded

        // For reading/document/link lessons: use admin-set duration (minutes)
        const durationMinutes = activeLesson.duration || 1
        const totalSeconds = durationMinutes * 60
        let elapsed = 0

        setReadingProgress(0)
        if (readingTimerRef.current) clearInterval(readingTimerRef.current)

        readingTimerRef.current = setInterval(() => {
            elapsed++
            const pct = Math.min(100, Math.round((elapsed / totalSeconds) * 100))
            setReadingProgress(pct)
            if (elapsed >= totalSeconds) {
                if (readingTimerRef.current) clearInterval(readingTimerRef.current)
                // Auto-complete
                handleComplete(activeLesson)
            }
        }, 1000)

        return () => {
            if (readingTimerRef.current) clearInterval(readingTimerRef.current)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeLesson?.id, enrolled])

    // Handle video completion (called by YouTube API or HTML5 video ended)
    const onVideoCompleted = useCallback(() => {
        if (videoCompletedRef.current) return
        videoCompletedRef.current = true
        if (activeLesson && enrolled && !isCompleted(activeLesson.id)) {
            handleComplete(activeLesson)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeLesson, enrolled, progress])

    // Load YouTube IFrame API script once
    useEffect(() => {
        if (typeof window !== 'undefined' && !(window as any).YT) {
            const tag = document.createElement('script')
            tag.src = 'https://www.youtube.com/iframe_api'
            document.head.appendChild(tag)
        }
    }, [])

    // Select lesson (with lock check)
    const selectLesson = async (lesson: Lesson) => {
        // Reset video completion tracking
        videoCompletedRef.current = false
        setReadingProgress(0)
        if (readingTimerRef.current) clearInterval(readingTimerRef.current)

        // Destroy old YouTube player
        if (ytPlayerRef.current) {
            try { ytPlayerRef.current.destroy() } catch {}
            ytPlayerRef.current = null
        }

        setActiveLesson(lesson)
        setActiveQuizModuleId(null)
        setQuizData(null)
        setQuizResult(null)

        // Reset transcript state — the useEffect on activeLesson.id will re-fetch
        if (subtitleRafRef.current) cancelAnimationFrame(subtitleRafRef.current)

        // If revisiting a completed lesson, log a review activity
        if (enrolled && isCompleted(lesson.id) && course) {
            const mod = course.modules.find(m => m.lessons.some(l => l.id === lesson.id))
            if (mod) {
                fetch(`/api/training/${course.id}/review`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        moduleId: mod.id,
                        lessonId: lesson.id,
                        activityType: lesson.contentType === 'video' ? 'video_watched' : 'lesson_viewed',
                        duration: 0,
                    }),
                }).then(r => r.json()).then(data => {
                    if (data.xpGained) addToast(`+${data.xpGained} XP (review) 📖`, '#a855f7')
                    setEnrollmentMode('review')
                    loadProgress(course.id)
                }).catch(() => { /* silent */ })
            }
        }

        // Initialize YouTube player for video lessons
        if (lesson.contentType === 'video' && lesson.contentUrl) {
            const videoId = extractYouTubeId(lesson.contentUrl)
            if (videoId) {
                // Wait for YT API to load, then create player
                const initPlayer = () => {
                    if ((window as any).YT && (window as any).YT.Player) {
                        ytPlayerRef.current = new (window as any).YT.Player('yt-player-container', {
                            videoId,
                            playerVars: { rel: 0, modestbranding: 1 },
                            events: {
                                onStateChange: (event: any) => {
                                    // 0 = YT.PlayerState.ENDED
                                    if (event.data === 0) {
                                        onVideoCompleted()
                                    }
                                },
                            },
                        })
                    } else {
                        setTimeout(initPlayer, 200)
                    }
                }
                // Need a short delay so the DOM element exists
                setTimeout(initPlayer, 100)
            }
        }
    }

    // Extract YouTube video ID from URL
    const extractYouTubeId = (url: string): string | null => {
        const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([-\w]+)/)
        return match ? match[1] : null
    }

    // Subtitle tracking — poll video player for current time (throttled to ~4fps)
    useEffect(() => {
        if (!activeLesson || activeLesson.contentType !== 'video' || transcriptSegments.length === 0) return

        let lastUpdate = 0
        const THROTTLE_MS = 250

        const getCurrentTime = (): number => {
            if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
                return ytPlayerRef.current.getCurrentTime()
            }
            if (videoRef.current) {
                return videoRef.current.currentTime
            }
            return 0
        }

        const tick = () => {
            const now = performance.now()
            if (now - lastUpdate >= THROTTLE_MS) {
                lastUpdate = now
                const currentTime = getCurrentTime()
                setVideoCurrentTime(currentTime)
                if (currentTime > 0) {
                    const idx = transcriptSegments.findIndex(
                        (seg: TranscriptSegment) => currentTime >= seg.start && currentTime <= seg.end
                    )
                    setCurrentSegmentIndex(idx)
                }
            }
            subtitleRafRef.current = requestAnimationFrame(tick)
        }
        subtitleRafRef.current = requestAnimationFrame(tick)

        return () => {
            if (subtitleRafRef.current) cancelAnimationFrame(subtitleRafRef.current)
        }
    }, [activeLesson?.id, transcriptSegments])

    // Get display segments — use translated version if available
    const getDisplaySegments = (): TranscriptSegment[] => {
        if (locale !== 'en' && transcriptTranslations && transcriptTranslations[locale]) {
            return transcriptTranslations[locale]
        }
        return transcriptSegments
    }

    // Load and show quiz for a module
    const openQuiz = async (moduleId: string) => {
        if (!course) return
        setActiveQuizModuleId(moduleId)
        setActiveLesson(null)
        setQuizResult(null)
        setQuizAnswers({})
        setQuizData(null)
        setQuizError(null)
        setQuizLoading(true)
        try {
            const res = await fetch(`/api/training/${course.id}/quiz?moduleId=${moduleId}`)
            const data = await res.json()
            if (res.ok) {
                setQuizData(data.quiz)
                setQuizAttempts(data.attempts || [])
                setRetakeGated(data.retakeGated || false)
                setReviewsNeeded(data.reviewsNeeded || 0)
                setReviewsDone(data.reviewsDone || 0)
            } else {
                setQuizError(data.error || `Failed to load quiz (${res.status})`)
            }
        } catch (err) {
            setQuizError('Could not load quiz. Please try again.')
            console.error('Quiz load error:', err)
        } finally {
            setQuizLoading(false)
        }
    }

    // Submit quiz
    const submitQuiz = async () => {
        if (!quizData || !course || quizSubmitting) return
        setQuizSubmitting(true)
        try {
            const res = await fetch(`/api/training/${course.id}/quiz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quizId: quizData.id, answers: quizAnswers }),
            })
            if (res.ok) {
                const result = await res.json()
                setQuizResult(result)
                addToast(`+${result.xpGained} XP! ${result.attempt.passed ? '🎉' : '📊'}`, result.attempt.passed ? '#22c55e' : '#f59e0b')
                if (result.attempt.passed) triggerConfetti()
                loadProgress(course.id)
            }
        } catch { addToast('Quiz submission failed', '#ef4444') }
        finally { setQuizSubmitting(false) }
    }

    const handleComplete = async (lesson: Lesson) => {
        if (!course || completing) return

        // Auto-enroll if not yet enrolled (seamless for logged-in users)
        if (!enrolled) {
            const enrollRes = await fetch(`/api/training/${course.id}/progress`, { method: 'POST' })
            if (enrollRes.ok) {
                setEnrolled(true)
            } else {
                const data = await enrollRes.json()
                if (data.error === 'Unauthorized') {
                    window.location.href = `/${locale}/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`
                    return
                }
            }
        }

        setCompleting(true)
        try {
            const r = await fetch(`/api/training/${course.id}/progress`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lessonId: lesson.id }),
            })
            if (r.ok) {
                const result = await r.json()
                addToast(`+${result.xpGained} XP! 🎯`, '#d4a853')
                if (result.moduleComplete) {
                    triggerConfetti()
                    addToast(`🏆 ${t('moduleComplete')}`, '#a855f7')
                }
                if (result.courseComplete) {
                    triggerConfetti()
                    setTimeout(() => addToast(`🎓 ${t('courseComplete')}`, '#22c55e'), 800)
                }
                result.newBadges?.forEach((b: string) => {
                    const icon = BADGE_ICONS[b]
                    const keys = BADGE_KEYS[b]
                    if (icon && keys) addToast(`${icon} ${t(keys.label)}!`, '#f59e0b')
                })
                loadProgress(course.id)
            }
        } catch { addToast('Failed to save progress', '#ef4444') }
        finally { setCompleting(false) }
    }

    const isCompleted = (lessonId: string) => progress.some(p => p.lessonId === lessonId && p.completed)

    if (loading) return (
        <>
<main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="loading-spinner" />
            </main>
        </>
    )

    if (!course) return (
        <>
<main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                <div>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📚</div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>{t('courseNotFound')}</h1>
                    <Link href="/training" style={{ color: 'var(--accent-gold)', textDecoration: 'underline' }}>← {t('backToHub')}</Link>
                </div>
            </main>
        </>
    )

    const totalLessons = course.modules.reduce((s, m) => s + m.lessons.length, 0)
    const completedLessons = progress.filter(p => p.completed).length
    const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
    const totalDuration = course.modules.reduce((s, m) => s + m.lessons.reduce((ls, l) => ls + (l.duration || 0), 0), 0)
    const formatDuration = (mins: number) => {
        if (mins <= 0) return t('selfPaced')
        if (mins < 60) return `${mins} ${t('min')}`
        const h = Math.floor(mins / 60)
        const m = mins % 60
        return m > 0 ? `${h}${t('hour')} ${m}${t('min')}` : `${h}${t('hour')}`
    }
    const catIcon = CAT_ICONS[course.category] || '📚'

    // For admin preview: treat as enrolled so gates are bypassed
    const effectiveEnrolled = enrolled || isAdminPreview

    return (
        <>
{/* Admin Preview Banner */}
            {isAdminPreview && (
                <div style={{
                    position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 9999, padding: '10px 28px', borderRadius: '24px',
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.95), rgba(234,88,12,0.95))',
                    color: '#fff', fontWeight: 700, fontSize: '0.78rem',
                    boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
                    display: 'flex', alignItems: 'center', gap: '14px',
                    backdropFilter: 'blur(10px)',
                }}>
                    👁️ Admin Preview — All content unlocked
                    <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.3)' }} />
                    <a href={`/admin/training/${course.id}/edit`} style={{
                        color: '#fff', fontSize: '0.72rem', fontWeight: 700,
                        textDecoration: 'none', padding: '4px 12px', borderRadius: '12px',
                        background: 'rgba(255,255,255,0.2)', transition: 'background 0.2s',
                    }}>← Back to Admin</a>
                    <a href={window.location.pathname} style={{
                        color: '#fff', opacity: 0.7,
                        fontSize: '0.68rem', textDecoration: 'underline',
                    }}>Exit Preview</a>
                </div>
            )}

            {/* Confetti */}
            {showConfetti && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none', overflow: 'hidden' }}>
                    {Array.from({ length: 60 }).map((_, i) => (
                        <div key={i} style={{
                            position: 'absolute',
                            left: `${Math.random() * 100}%`, top: '-10px',
                            width: `${6 + Math.random() * 8}px`, height: `${6 + Math.random() * 8}px`,
                            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                            background: ['#d4a853', '#34d399', '#a855f7', '#f59e0b', '#3b82f6', '#ef4444', '#22c55e'][Math.floor(Math.random() * 7)],
                            animation: `confetti-fall ${1.5 + Math.random() * 2}s ease-out ${Math.random() * 0.5}s forwards`,
                            opacity: 0.9,
                        }} />
                    ))}
                    <style>{`
                        @keyframes confetti-fall {
                            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                            100% { transform: translateY(100vh) rotate(${360 + Math.random() * 720}deg); opacity: 0; }
                        }
                    `}</style>
                </div>
            )}

            {/* Toast Notifications */}
            <div style={{ position: 'fixed', top: '80px', right: '20px', zIndex: 9998, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {toasts.map(t => (
                    <div key={t.id} style={{
                        padding: '10px 20px', borderRadius: '10px',
                        background: 'var(--bg-secondary)', border: `1px solid ${t.color}30`,
                        color: t.color, fontWeight: 700, fontSize: '0.85rem',
                        boxShadow: `0 4px 20px ${t.color}15`,
                        animation: 'toast-in 0.3s ease-out',
                    }}>{t.text}</div>
                ))}
                <style>{`@keyframes toast-in { 0% { transform: translateX(100px); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }`}</style>
            </div>

            <main style={{ minHeight: '100vh', paddingTop: '5rem' }}>
                {/* Course Hero */}
                <section style={{
                    padding: '3rem 1.5rem 2rem',
                    background: 'linear-gradient(180deg, rgba(212,168,83,0.05) 0%, transparent 100%)',
                }}>
                    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
                        <Link href="/training" style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', textDecoration: 'none', marginBottom: '16px', display: 'inline-block' }}>
                            ← {t('backToHub')}
                        </Link>

                        <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <div style={{
                                width: '64px', height: '64px', borderRadius: '16px', flexShrink: 0,
                                background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
                            }}>{catIcon}</div>

                            <div style={{ flex: 1, minWidth: '250px' }}>
                                <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 900, marginBottom: '8px', lineHeight: 1.2, fontFamily: 'var(--font-display)' }}>
                                    {tr(course.translations, 'title', course.title)}
                                </h1>
                                <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px', maxWidth: '600px' }}>
                                    {tr(course.translations, 'description', course.description)}
                                </p>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {[
                                        { label: `${course.modules.length} ${t('modules')}`, icon: '📦' },
                                        { label: `${totalLessons} ${t('lessons')}`, icon: '📚' },
                                        { label: formatDuration(totalDuration), icon: '⏱️' },
                                        { label: `${course._count.enrollments} ${t('students')}`, icon: '👥' },
                                    ].map(s => (
                                        <span key={s.label} style={{
                                            fontSize: '0.72rem', padding: '3px 10px', borderRadius: '20px',
                                            background: 'rgba(255,255,255,0.04)', color: 'var(--text-tertiary)', fontWeight: 500,
                                        }}>{s.icon} {s.label}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Progress Bar + Enroll */}
                        <div style={{
                            marginTop: '24px', padding: '16px 20px', borderRadius: '14px',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                            display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap',
                        }}>
                            {effectiveEnrolled ? (
                                <>
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {completedLessons}/{totalLessons} {t('lessonsCompleted')}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent-gold)' }}>
                                                {progressPct}%
                                            </span>
                                        </div>
                                        <div style={{
                                            height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                width: `${progressPct}%`, height: '100%', borderRadius: '4px',
                                                background: progressPct === 100 ? 'linear-gradient(90deg, #34d399, #22c55e)' : 'linear-gradient(90deg, var(--accent-gold), #d4a853)',
                                                transition: 'width 0.5s ease',
                                            }} />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--accent-gold)' }}>{xp}</div>
                                            <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>{t('xp')}</div>
                                        </div>
                                        <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }} />
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: '1.1rem', fontWeight: 900, color: streak > 0 ? '#f59e0b' : 'var(--text-tertiary)' }}>🔥 {streak}</div>
                                            <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>{t('streak')}</div>
                                        </div>
                                        {enrollmentMode === 'review' && (
                                            <>
                                                <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }} />
                                                <div style={{
                                                    padding: '4px 10px', borderRadius: '12px',
                                                    background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)',
                                                    fontSize: '0.65rem', fontWeight: 700, color: '#a855f7',
                                                }}>📖 {t('reviewMode')}</div>
                                            </>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>{t('startLearning')}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                                            {t('enrollDesc')}
                                        </div>
                                    </div>
                                    <button onClick={handleEnroll} style={{
                                        padding: '10px 28px', borderRadius: 'var(--radius-full)',
                                        border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem',
                                        background: 'var(--accent-gold)', color: '#0a0a0a',
                                    }}>🚀 {t('enrollFree')}</button>
                                </>
                            )}
                        </div>

                        {/* Badges */}
                        {badges.length > 0 && (
                            <div style={{
                                marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap',
                            }}>
                                {badges.map(b => {
                                    const icon = BADGE_ICONS[b.badgeType]
                                    const keys = BADGE_KEYS[b.badgeType]
                                    if (!icon || !keys) return null
                                    return (
                                        <div key={b.badgeType} title={t(keys.desc)} style={{
                                            padding: '4px 12px', borderRadius: '20px',
                                            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)',
                                            fontSize: '0.72rem', fontWeight: 600, color: '#f59e0b',
                                        }}>{icon} {t(keys.label)}</div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </section>

                {/* Course Content — Gated Behind Enrollment */}
                <section style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 1.5rem 4rem' }}>
                    {!effectiveEnrolled ? (
                        /* ═══ ENROLLMENT GATE ═══ */
                        <div style={{
                            position: 'relative', overflow: 'hidden',
                            borderRadius: '20px', padding: '3rem 2.5rem',
                            background: 'linear-gradient(135deg, rgba(212,168,83,0.06) 0%, rgba(168,85,247,0.04) 50%, rgba(59,130,246,0.04) 100%)',
                            border: '1px solid rgba(212,168,83,0.12)',
                            textAlign: 'center',
                        }}>
                            {/* Decorative orbs */}
                            <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '150px', height: '150px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,83,0.08), transparent)', pointerEvents: 'none' }} />
                            <div style={{ position: 'absolute', bottom: '-30px', left: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.06), transparent)', pointerEvents: 'none' }} />

                            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '10px', fontFamily: 'var(--font-display)' }}>
                                {t('enrollToAccess')}
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto 24px', lineHeight: 1.6 }}>
                                {t('enrollGateDesc')}
                            </p>

                            {/* What you'll get */}
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap', marginBottom: '28px' }}>
                                {[
                                    { icon: '📦', text: `${course.modules.length} ${t('modules')}` },
                                    { icon: '📚', text: `${totalLessons} ${t('lessons')}` },
                                    { icon: '⏱️', text: formatDuration(totalDuration) },
                                    { icon: '🏆', text: t('certificate') },
                                ].map(f => (
                                    <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '1.2rem' }}>{f.icon}</span>
                                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{f.text}</span>
                                    </div>
                                ))}
                            </div>

                            <button onClick={handleEnroll} disabled={enrolling} style={{
                                padding: '14px 42px', borderRadius: 'var(--radius-full)',
                                border: 'none', cursor: enrolling ? 'not-allowed' : 'pointer',
                                fontWeight: 800, fontSize: '1rem',
                                background: 'linear-gradient(135deg, var(--accent-gold), #e8c356)',
                                color: '#0a0a0a',
                                boxShadow: '0 4px 20px rgba(212,168,83,0.25)',
                                transition: 'all 0.3s ease',
                                opacity: enrolling ? 0.7 : 1,
                            }}>{enrolling ? '⏳ Enrolling...' : `🚀 ${t('enrollFree')}`}</button>

                            {/* Preview: blurred module list */}
                            <div style={{ marginTop: '32px', opacity: 0.4, filter: 'blur(2px)', pointerEvents: 'none' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '12px' }}>
                                    📦 {t('curriculum')}
                                </div>
                                {course.modules.slice(0, 3).map((mod, mi) => (
                                    <div key={mod.id} style={{
                                        padding: '10px 12px', marginBottom: '4px', borderRadius: '8px',
                                        background: 'rgba(255,255,255,0.03)', textAlign: 'left',
                                        fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)',
                                    }}>
                                        ▶ {tr(mod.translations, 'title', mod.title || `Module ${mi + 1}`)} · {mod.lessons.length} {t('lessons')}
                                    </div>
                                ))}
                                {course.modules.length > 3 && (
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                                        +{course.modules.length - 3} more modules...
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* ═══ ENROLLED — FULL COURSE CONTENT ═══ */
                        <div className="course-content-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
                            <style>{`
                                @media (max-width: 768px) {
                                    .course-content-grid { grid-template-columns: 1fr !important; }
                                    .course-sidebar { position: static !important; max-height: none !important; }
                                }
                            `}</style>

                            {/* Module sidebar */}
                            <div className="course-sidebar" style={{ position: 'sticky', top: '5rem', alignSelf: 'start', maxHeight: 'calc(100vh - 6rem)', overflowY: 'auto' }}>
                                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-gold)', marginBottom: '12px' }}>
                                    📦 {t('curriculum')}
                                </div>

                                {course.modules.map((mod, mi) => {
                                    const modLessonsCompleted = mod.lessons.filter(l => isCompleted(l.id)).length
                                    const modComplete = modLessonsCompleted === mod.lessons.length && mod.lessons.length > 0
                                    const modPct = mod.lessons.length > 0 ? Math.round((modLessonsCompleted / mod.lessons.length) * 100) : 0
                                    return (
                                        <div key={mod.id} style={{ marginBottom: '6px' }}>
                                            <button onClick={() => setExpandedModule(expandedModule === mi ? -1 : mi)} style={{
                                                width: '100%', padding: '10px 12px', textAlign: 'left',
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                border: 'none', borderRadius: '10px', cursor: 'pointer',
                                                background: expandedModule === mi ? 'rgba(255,255,255,0.04)' : 'transparent',
                                                color: 'var(--text-primary)', transition: 'all 0.15s',
                                            }}>
                                                <span style={{
                                                    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.55rem', fontWeight: 800,
                                                    background: modComplete ? 'rgba(34,197,94,0.15)' : modPct > 0 ? 'rgba(212,168,83,0.12)' : 'rgba(255,255,255,0.06)',
                                                    color: modComplete ? '#22c55e' : modPct > 0 ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                                    border: `1.5px solid ${modComplete ? 'rgba(34,197,94,0.3)' : modPct > 0 ? 'rgba(212,168,83,0.25)' : 'rgba(255,255,255,0.08)'}`,
                                                    transition: 'all 0.3s',
                                                }}>
                                                    {modComplete ? '✓' : modPct > 0 ? `${modPct}` : (mi + 1)}
                                                </span>
                                                <span style={{ flex: 1, fontWeight: 700, fontSize: '0.82rem' }}>{tr(mod.translations, 'title', mod.title || `Module ${mi + 1}`)}</span>
                                                <span style={{
                                                    fontSize: '0.6rem', fontWeight: 700,
                                                    color: modComplete ? '#22c55e' : modPct > 0 ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                                }}>
                                                    {modLessonsCompleted}/{mod.lessons.length}
                                                </span>
                                            </button>

                                            {expandedModule === mi && (
                                                <div style={{ padding: '0 0 0 20px' }}>
                                                    {mod.lessons.map((lesson, li) => {
                                                        const done = isCompleted(lesson.id)
                                                        const isActive = activeLesson?.id === lesson.id
                                                        const locked = isLessonLocked(mi, li)
                                                        return (
                                                            <button key={lesson.id}
                                                                onClick={() => !locked && selectLesson(lesson)}
                                                                disabled={locked}
                                                                style={{
                                                                    width: '100%', padding: '8px 10px', textAlign: 'left',
                                                                    display: 'flex', alignItems: 'center', gap: '6px',
                                                                    border: 'none', borderRadius: '6px',
                                                                    cursor: locked ? 'not-allowed' : 'pointer',
                                                                    opacity: locked ? 0.4 : 1,
                                                                    background: isActive ? (done ? 'rgba(34,197,94,0.06)' : 'rgba(212,168,83,0.08)') : 'transparent',
                                                                    borderLeft: isActive ? `2px solid ${done ? '#22c55e' : 'var(--accent-gold)'}` : '2px solid transparent',
                                                                    transition: 'all 0.3s', fontSize: '0.78rem',
                                                                }}>
                                                                <span style={{
                                                                    width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    fontSize: '0.55rem',
                                                                    background: locked ? 'rgba(255,255,255,0.03)' : done ? 'rgba(34,197,94,0.15)' : isActive ? 'rgba(212,168,83,0.15)' : 'rgba(255,255,255,0.04)',
                                                                    color: locked ? 'var(--text-tertiary)' : done ? '#22c55e' : isActive ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                                                    border: `1.5px solid ${locked ? 'rgba(255,255,255,0.06)' : done ? 'rgba(34,197,94,0.4)' : isActive ? 'rgba(212,168,83,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                                                    transition: 'all 0.4s ease',
                                                                }}>
                                                                    {locked ? '🔒' : done ? '✓' : isActive ? '▸' : ''}
                                                                </span>
                                                                <span style={{
                                                                    flex: 1, fontWeight: done ? 500 : 600,
                                                                    color: locked ? 'var(--text-tertiary)' : done ? '#22c55e' : isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                                                    transition: 'color 0.3s',
                                                                }}>
                                                                    {tr(lesson.translations, 'title', lesson.title || `Lesson ${lesson.sortOrder + 1}`)}
                                                                </span>
                                                                {locked ? (
                                                                    <span style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)' }}>🔒</span>
                                                                ) : lesson.duration ? (
                                                                    <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>{lesson.duration}m</span>
                                                                ) : null}
                                                            </button>
                                                        )
                                                    })}
                                                    {/* Quiz button at end of module */}
                                                    {(modComplete || isAdminPreview) && (
                                                        <button onClick={() => openQuiz(mod.id)} style={{
                                                            width: '100%', padding: '8px 10px', textAlign: 'left',
                                                            display: 'flex', alignItems: 'center', gap: '6px',
                                                            border: 'none', borderRadius: '6px', cursor: 'pointer',
                                                            background: activeQuizModuleId === mod.id ? 'rgba(245,158,11,0.08)' : 'transparent',
                                                            borderLeft: activeQuizModuleId === mod.id ? '2px solid #f59e0b' : '2px solid transparent',
                                                            transition: 'all 0.3s', fontSize: '0.78rem',
                                                        }}>
                                                            <span style={{
                                                                width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                fontSize: '0.55rem', background: 'rgba(245,158,11,0.15)',
                                                                color: '#f59e0b', border: '1.5px solid rgba(245,158,11,0.3)',
                                                            }}>📝</span>
                                                            <span style={{ flex: 1, fontWeight: 600, color: '#f59e0b' }}>{t('quizLabel')}</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Lesson/Quiz viewer */}
                            <div>
                                {/* Quiz Player */}
                                {activeQuizModuleId && quizLoading ? (
                                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                                        <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
                                        {t('loadingQuiz')}
                                    </div>
                                ) : activeQuizModuleId && quizError ? (
                                    <div style={{
                                        padding: '40px', textAlign: 'center',
                                        background: 'var(--bg-secondary)', borderRadius: '16px',
                                        border: '1px solid rgba(239,68,68,0.2)',
                                    }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⚠️</div>
                                        <div style={{ fontWeight: 700, marginBottom: '8px', color: '#ef4444' }}>{t('quizUnavailable')}</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', marginBottom: '16px' }}>{quizError}</div>
                                        <button onClick={() => openQuiz(activeQuizModuleId)} style={{
                                            padding: '8px 20px', borderRadius: '20px', border: '1px solid rgba(239,68,68,0.3)',
                                            background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                                        }}>{t('tryAgain')}</button>
                                    </div>
                                ) : activeQuizModuleId && quizData ? (
                                    <div style={{
                                        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                                        borderRadius: '16px', overflow: 'hidden',
                                    }}>
                                        <div style={{ padding: '24px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(245,158,11,0.04)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '4px' }}>📝 {tr(quizData.translations, 'title', quizData.title)}</h2>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                        {quizData.questionCount} {t('quizQuestions')} • {t('quizPass')}: {quizData.passMark}% • {t('quizMaxAttempts', { count: quizData.maxAttempts })}
                                                    </div>
                                                </div>
                                                {quizAttempts.length > 0 && (
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: quizAttempts[0].passed ? '#22c55e' : '#ef4444' }}>
                                                            {quizAttempts[0].score}%
                                                        </div>
                                                        <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>{t('lastScore')}</div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* Quiz Result */}
                                        {quizResult ? (
                                            <div style={{ padding: '30px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '3rem', marginBottom: '12px' }}>{quizResult.passed ? '🎉' : '📊'}</div>
                                                <div style={{ fontSize: '2rem', fontWeight: 900, color: quizResult.passed ? '#22c55e' : '#ef4444', marginBottom: '6px' }}>
                                                    {quizResult.score}%
                                                </div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '4px', color: quizResult.passed ? '#22c55e' : '#ef4444' }}>
                                                    {quizResult.passed ? `✅ ${t('quizPassed')}` : `❌ ${t('quizNotPassed')}`}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
                                                    {t('quizCorrect', { correct: quizResult.correctCount, total: quizResult.totalQuestions })} • +{quizResult.xpGained} {t('xp')}
                                                </div>
                                                {!quizResult.passed && (
                                                    <div style={{ maxWidth: '320px', margin: '0 auto' }}>
                                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.6 }}>
                                                            {t('reviewToRetake')}
                                                        </p>
                                                        <button onClick={() => { setQuizResult(null); setQuizAnswers({}); openQuiz(activeQuizModuleId!) }} style={{
                                                            padding: '10px 28px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                                            fontWeight: 700, fontSize: '0.85rem', background: 'var(--accent-gold)', color: '#0a0a0a',
                                                        }}>🔄 {t('checkRetake')}</button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : retakeGated ? (
                                            /* Retake Gating Screen */
                                            <div style={{ padding: '30px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📖</div>
                                                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '8px' }}>{t('reviewRequired')}</h3>
                                                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '360px', margin: '0 auto 20px', lineHeight: 1.6 }}>
                                                    {t('reviewRequiredDesc')}
                                                </p>
                                                <div style={{
                                                    maxWidth: '260px', margin: '0 auto 16px', padding: '12px 16px',
                                                    borderRadius: '12px', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.1)',
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a855f7' }}>{t('reviewProgress')}</span>
                                                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#a855f7' }}>{reviewsDone}/{reviewsNeeded}</span>
                                                    </div>
                                                    <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(168,85,247,0.1)', overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: `${Math.min(100, (reviewsDone / reviewsNeeded) * 100)}%`,
                                                            height: '100%', borderRadius: '3px',
                                                            background: 'linear-gradient(90deg, #a855f7, #c084fc)',
                                                            transition: 'width 0.5s ease',
                                                        }} />
                                                    </div>
                                                </div>
                                                <button onClick={() => openQuiz(activeQuizModuleId!)} style={{
                                                    padding: '8px 20px', borderRadius: '20px', border: '1px solid rgba(168,85,247,0.2)',
                                                    cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem',
                                                    background: 'transparent', color: '#a855f7',
                                                }}>↻ {t('refreshStatus')}</button>
                                            </div>
                                        ) : (
                                            /* Quiz Questions */
                                            <div style={{ padding: '20px' }}>
                                                {quizData.questions.map((q, qi) => (
                                                    <div key={q.id} style={{
                                                        marginBottom: '20px', padding: '16px', borderRadius: '12px',
                                                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                                                    }}>
                                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b', marginBottom: '6px' }}>Q{qi + 1}</div>
                                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '12px', lineHeight: 1.5 }}>
                                                            {tr(q.translations, 'questionText', q.questionText)}
                                                        </div>
                                                        {q.questionType === 'truefalse' ? (
                                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                                {['true', 'false'].map(opt => (
                                                                    <button key={opt} onClick={() => setQuizAnswers(prev => ({ ...prev, [q.id]: opt }))} style={{
                                                                        flex: 1, padding: '12px', borderRadius: '10px', cursor: 'pointer',
                                                                        fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.2s',
                                                                        border: quizAnswers[q.id] === opt ? '2px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.08)',
                                                                        background: quizAnswers[q.id] === opt ? 'rgba(212,168,83,0.1)' : 'rgba(255,255,255,0.02)',
                                                                        color: quizAnswers[q.id] === opt ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                                                    }}>{opt === 'true' ? t('quizTrue') : t('quizFalse')}</button>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div style={{ display: 'grid', gap: '8px' }}>
                                                                {q.options.map(opt => (
                                                                    <button key={opt.id} onClick={() => setQuizAnswers(prev => ({ ...prev, [q.id]: opt.id }))} style={{
                                                                        padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                                                                        textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                                                                        fontWeight: 500, fontSize: '0.85rem', transition: 'all 0.2s',
                                                                        border: quizAnswers[q.id] === opt.id ? '2px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.08)',
                                                                        background: quizAnswers[q.id] === opt.id ? 'rgba(212,168,83,0.1)' : 'rgba(255,255,255,0.02)',
                                                                        color: quizAnswers[q.id] === opt.id ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                                                    }}>
                                                                        <span style={{
                                                                            width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            fontSize: '0.7rem', fontWeight: 700,
                                                                            background: quizAnswers[q.id] === opt.id ? 'var(--accent-gold)' : 'rgba(255,255,255,0.06)',
                                                                            color: quizAnswers[q.id] === opt.id ? '#0a0a0a' : 'var(--text-tertiary)',
                                                                        }}>{opt.id.toUpperCase()}</span>
                                                                        {tr(q.translations, `option_${opt.id}`, opt.text)}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                                {/* Submit */}
                                                <button onClick={submitQuiz} disabled={quizSubmitting || Object.keys(quizAnswers).length < quizData.questions.length} style={{
                                                    width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                                                    cursor: quizSubmitting ? 'wait' : 'pointer', fontWeight: 800, fontSize: '0.95rem',
                                                    background: Object.keys(quizAnswers).length >= quizData.questions.length ? 'var(--accent-gold)' : 'rgba(255,255,255,0.06)',
                                                    color: Object.keys(quizAnswers).length >= quizData.questions.length ? '#0a0a0a' : 'var(--text-tertiary)',
                                                    opacity: quizSubmitting ? 0.7 : 1, transition: 'all 0.2s',
                                                }}>{quizSubmitting ? `⏳ ${t('grading')}` : `${t('submitQuiz')} (${Object.keys(quizAnswers).length}/${quizData.questions.length})`}</button>
                                            </div>
                                        )}
                                    </div>
                                ) : activeLesson ? (
                                    <div style={{
                                        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                                        borderRadius: '16px', overflow: 'hidden',
                                    }}>
                                        {/* Video / Content area */}
                                        {activeLesson.contentType === 'video' && activeLesson.contentUrl && extractYouTubeId(activeLesson.contentUrl) && (
                                            <div style={{
                                                position: 'relative', paddingBottom: '56.25%', background: '#000',
                                            }}>
                                                <div id="yt-player-container" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
                                            </div>
                                        )}

                                        {/* Uploaded video file */}
                                        {activeLesson.contentType === 'video' && activeLesson.uploadPath && !extractYouTubeId(activeLesson.contentUrl || '') && (
                                            <div style={{ position: 'relative', background: '#000' }}>
                                                <video
                                                    ref={videoRef}
                                                    key={activeLesson.id}
                                                    controls
                                                    controlsList="nodownload"
                                                    disablePictureInPicture
                                                    onContextMenu={e => e.preventDefault()}
                                                    style={{ width: '100%', maxHeight: '560px' }}
                                                    onEnded={() => onVideoCompleted()}
                                                >
                                                    <source src={activeLesson.uploadPath} />
                                                    Your browser does not support the video tag.
                                                </video>
                                            </div>
                                        )}

                                        {/* Full Scrollable Transcript with Eye-Trace Box */}
                                        {activeLesson.contentType === 'video' && transcriptSegments.length > 0 && (() => {
                                            const displaySegs = getDisplaySegments()
                                            const RTL_LOCALES = ['ar', 'he', 'fa', 'ur']
                                            const isRtl = RTL_LOCALES.includes(locale)
                                            return (
                                                <FullTranscript
                                                    segments={displaySegs}
                                                    currentTime={videoCurrentTime}
                                                    isRtl={isRtl}
                                                />
                                            )
                                        })()}

                                        {activeLesson.contentUrl && activeLesson.contentType === 'link' && (
                                            <div style={{ padding: '30px', textAlign: 'center', background: 'rgba(59,130,246,0.04)' }}>
                                                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🔗</div>
                                                <a href={activeLesson.contentUrl} target="_blank" rel="noopener noreferrer" style={{
                                                    color: '#3b82f6', fontWeight: 700, fontSize: '0.9rem',
                                                }}>{t('openResource')} →</a>
                                            </div>
                                        )}

                                        {activeLesson.contentUrl && activeLesson.contentType === 'document' && (
                                            <div style={{ padding: '30px', textAlign: 'center', background: 'rgba(168,85,247,0.04)' }}>
                                                <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📄</div>
                                                <a href={activeLesson.contentUrl} target="_blank" rel="noopener noreferrer" style={{
                                                    color: '#a855f7', fontWeight: 700, fontSize: '0.9rem',
                                                }}>{t('viewDocument')} →</a>
                                            </div>
                                        )}

                                        <div style={{ padding: '20px' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <div>
                                                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '4px' }}>
                                                        {tr(activeLesson.translations, 'title', activeLesson.title)}
                                                    </h2>
                                                    {activeLesson.duration && (
                                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>⏱️ {activeLesson.duration} {t('minutes')}</span>
                                                    )}
                                                </div>

                                                {(() => {
                                                    const currentModule = course.modules.find(m => m.lessons.some(l => l.id === activeLesson.id))
                                                    const moduleFullyComplete = currentModule
                                                        ? currentModule.lessons.length > 0 && currentModule.lessons.every(l => isCompleted(l.id))
                                                        : false
                                                    if (isCompleted(activeLesson.id)) {
                                                        return moduleFullyComplete ? (
                                                            <span style={{
                                                                padding: '6px 16px', borderRadius: '20px', fontSize: '0.78rem',
                                                                fontWeight: 700, background: 'rgba(168,85,247,0.12)', color: '#a855f7',
                                                                border: '1px solid rgba(168,85,247,0.25)',
                                                                transition: 'all 0.5s ease',
                                                            }}>🏆 {t('moduleComplete')}</span>
                                                        ) : (
                                                            <span style={{
                                                                padding: '6px 16px', borderRadius: '20px', fontSize: '0.78rem',
                                                                fontWeight: 700, background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                                                                border: '1px solid rgba(34,197,94,0.2)',
                                                                transition: 'all 0.5s ease',
                                                            }}>✅ {t('completed')}</span>
                                                        )
                                                    }
                                                    // Show progress indicator for non-completed lessons
                                                    if (activeLesson.contentType === 'video') {
                                                        return (
                                                            <span style={{
                                                                padding: '6px 16px', borderRadius: '20px', fontSize: '0.78rem',
                                                                fontWeight: 700, background: 'rgba(59,130,246,0.08)',
                                                                color: '#3b82f6',
                                                                border: '1px solid rgba(59,130,246,0.2)',
                                                            }}>🎥 {completing ? '⏳ Completing...' : 'Watch to complete'}</span>
                                                        )
                                                    }
                                                    // Reading progress with bar
                                                    return (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{
                                                                width: '80px', height: '6px', borderRadius: '3px',
                                                                background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
                                                            }}>
                                                                <div style={{
                                                                    width: `${readingProgress}%`, height: '100%',
                                                                    borderRadius: '3px',
                                                                    background: readingProgress >= 100 ? '#22c55e' : 'var(--accent-gold)',
                                                                    transition: 'width 1s linear',
                                                                }} />
                                                            </div>
                                                            <span style={{
                                                                fontSize: '0.7rem', fontWeight: 600,
                                                                color: readingProgress >= 100 ? '#22c55e' : 'var(--text-tertiary)',
                                                            }}>{readingProgress}%</span>
                                                        </div>
                                                    )
                                                })()}
                                            </div>

                                            {activeLesson.description && (() => {
                                                const rawContent = tr(activeLesson.translations, 'description', activeLesson.description || '')
                                                // Simple markdown-to-HTML for AI-generated content
                                                const html = rawContent
                                                    .replace(/^### (.+)$/gm, '<h4 style="font-size:0.95rem;font-weight:700;margin:16px 0 6px;color:var(--text-primary)">$1</h4>')
                                                    .replace(/^## (.+)$/gm, '<h3 style="font-size:1.05rem;font-weight:800;margin:20px 0 8px;color:var(--text-primary)">$1</h3>')
                                                    .replace(/^\* (.+)$/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
                                                    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;padding-left:4px">$1</li>')
                                                    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="padding-left:20px;margin:8px 0">$&</ul>')
                                                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                                    .replace(/\*(.+?)\*/g, '<em>$1</em>')
                                                    .replace(/\n\n/g, '<br/><br/>')
                                                    .replace(/\n/g, '<br/>')
                                                return (
                                                    <div
                                                        style={{
                                                            fontSize: '0.88rem', color: 'var(--text-secondary)',
                                                            lineHeight: 1.7, paddingTop: '12px',
                                                            borderTop: '1px solid var(--border-subtle)',
                                                        }}
                                                        dangerouslySetInnerHTML={{ __html: html }}
                                                    />
                                                )
                                            })()}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{
                                        padding: '4rem', textAlign: 'center',
                                        background: 'var(--bg-secondary)', borderRadius: '16px',
                                        border: '1px solid var(--border-subtle)',
                                    }}>
                                        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📚</div>
                                        <p style={{ color: 'var(--text-tertiary)' }}>{t('selectLesson')}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>
            </main>
            <Footer />
        </>
    )
}
