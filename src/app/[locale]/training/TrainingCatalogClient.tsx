'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'

type HeroVideoItem = { id: string; url: string; duration: number; active: boolean }

type CourseData = {
    id: string; title: string; slug: string; description: string; thumbnail: string | null
    category: string; level: string; translations: string | null
    modules: { id: string; translations: string | null; lessons: { id: string; duration: number | null }[] }[]
    _count: { enrollments: number }
}

const CAT_META: Record<string, { icon: string; color: string; tKey: string }> = {
    acting:        { icon: '🎭', color: '#f59e0b', tKey: 'catActing' },
    cinematography:{ icon: '🎥', color: '#3b82f6', tKey: 'catCinematography' },
    directing:     { icon: '🎬', color: '#22c55e', tKey: 'catDirecting' },
    writing:       { icon: '✍️', color: '#ef4444', tKey: 'catWriting' },
    ai:            { icon: '🤖', color: '#a855f7', tKey: 'catAI' },
    production:    { icon: '🎙️', color: '#06b6d4', tKey: 'catProduction' },
    vfx:           { icon: '✨', color: '#ec4899', tKey: 'catVFX' },
}

const LEVEL_COLORS: Record<string, string> = {
    beginner: '#22c55e', intermediate: '#f59e0b', advanced: '#ef4444', all: '#3b82f6',
}

const LEVEL_KEYS: Record<string, string> = {
    beginner: 'levelBeginner', intermediate: 'levelIntermediate', advanced: 'levelAdvanced', all: 'levelAll',
}

export default function TrainingCatalogClient({ courses, isLoggedIn }: { courses: CourseData[]; isLoggedIn: boolean }) {
    const t = useTranslations('training')
    const locale = useLocale()

    /** Format raw minutes into '1h 30m', '45m', '2h', etc. */
    function fmtDuration(totalMin: number): string {
        if (totalMin <= 0) return ''
        const h = Math.floor(totalMin / 60)
        const m = totalMin % 60
        if (h > 0 && m > 0) return `${h}h ${m}m`
        if (h > 0) return `${h}h`
        return `${m}m`
    }

    const [heroVideos, setHeroVideos] = useState<HeroVideoItem[]>([])
    const [currentVideoIdx, setCurrentVideoIdx] = useState(0)
    const heroVideoRef = useRef<HTMLVideoElement>(null)
    const videoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [activeFilter, setActiveFilter] = useState<string>('all')

    useEffect(() => {
        fetch('/api/admin/media?type=hero-video&page=training')
            .then(r => r.json())
            .then((data: HeroVideoItem[]) => { if (data.length > 0) setHeroVideos(data) })
            .catch(() => {})
    }, [])

    const cycleHeroVideo = useCallback(() => {
        if (heroVideos.length <= 1) return
        setCurrentVideoIdx(prev => (prev + 1) % heroVideos.length)
    }, [heroVideos.length])

    useEffect(() => {
        if (heroVideos.length === 0) return
        const video = heroVideoRef.current
        if (!video) return
        video.src = heroVideos[currentVideoIdx].url
        video.load()
        video.play().catch(() => {})
        const durationMs = (heroVideos[currentVideoIdx].duration || 10) * 1000
        if (videoTimerRef.current) clearTimeout(videoTimerRef.current)
        videoTimerRef.current = setTimeout(cycleHeroVideo, durationMs)
        return () => { if (videoTimerRef.current) clearTimeout(videoTimerRef.current) }
    }, [currentVideoIdx, heroVideos, cycleHeroVideo])

    const tr = (translations: string | null, field: string, fallback: string) => {
        if (!translations || locale === 'en') return fallback
        try {
            const parsed = typeof translations === 'string' ? JSON.parse(translations) : translations
            return parsed?.[locale]?.[field] || fallback
        } catch { return fallback }
    }

    const totalLessons = courses.reduce((s, c) => s + c.modules.reduce((ms, m) => ms + m.lessons.length, 0), 0)
    const totalEnrollments = courses.reduce((s, c) => s + c._count.enrollments, 0)

    // Filter 'all' from dynamic categories to prevent a duplicate "All" filter pill
    const categories = ['all', ...Array.from(new Set(courses.map(c => c.category).filter(c => c !== 'all')))]
    const filtered = activeFilter === 'all' ? courses : courses.filter(c => c.category === activeFilter)

    return (
        <div style={{ overflowX: 'hidden', width: '100%' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Playfair+Display:ital,wght@1,700&family=Cinzel:wght@900&display=swap');
                @keyframes pulse-gold { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
                @keyframes float { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-8px);} }
                @keyframes scroll-hint { 0%,100%{opacity:0.4;transform:translateY(0);} 50%{opacity:1;transform:translateY(6px);} }
                @keyframes shimmer { 0%{background-position:-200% center;} 100%{background-position:200% center;} }
                @keyframes craft-glow { 0%,100%{filter:drop-shadow(0 0 18px rgba(228,185,90,0.55));} 50%{filter:drop-shadow(0 0 36px rgba(228,185,90,0.9));} }
                @keyframes title-reveal { from{opacity:0;transform:translateY(18px);} to{opacity:1;transform:translateY(0);} }
                .training-title-row { animation: title-reveal 0.8s cubic-bezier(.22,1,.36,1) both; }
                .training-title-row-2 { animation: title-reveal 0.8s 0.15s cubic-bezier(.22,1,.36,1) both; }
                .craft-shimmer {
                    background: linear-gradient(90deg, #f5d77e 0%, var(--accent-gold,#d4a853) 30%, #fff6c8 50%, var(--accent-gold,#d4a853) 70%, #b8870a 100%);
                    background-size: 200% auto;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    animation: shimmer 3.5s linear infinite, craft-glow 3.5s ease-in-out infinite;
                }
                .course-card { transition: transform 0.35s cubic-bezier(.4,0,.2,1), box-shadow 0.35s ease !important; }
                .course-card:hover { transform: translateY(-6px) scale(1.01) !important; box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(228,185,90,0.12) !important; }
                .filter-pill { transition: all 0.2s ease; cursor: pointer; }
                .filter-pill:hover { opacity: 0.9; }
            `}</style>

            {/* ─── Fixed video background ─── */}
            {heroVideos.length > 0 && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', zIndex: 0, background: '#0d0f14' }}>
                    <video
                        ref={heroVideoRef}
                        autoPlay muted loop playsInline
                        controlsList="nodownload"
                        onContextMenu={e => e.preventDefault()}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                </div>
            )}

            {/* ─── Fixed gradient overlay ─── */}
            <div style={{
                position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', zIndex: 0, pointerEvents: 'none',
                background: 'linear-gradient(180deg, rgba(13,15,20,0.3) 0%, rgba(13,15,20,0.1) 30%, rgba(13,15,20,0.25) 60%, rgba(13,15,20,0.85) 100%)',
            }} />

            {/* ─── HERO: full viewport ─── */}
            <section style={{ position: 'relative', height: '100vh', overflow: 'hidden', zIndex: 1 }}>
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 1,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', paddingTop: '70px',
                }}>
                    {/* Radial gold bloom */}
                    <div style={{
                        position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
                        width: '900px', height: '600px',
                        background: 'radial-gradient(ellipse, rgba(228,185,90,0.07) 0%, transparent 70%)',
                        pointerEvents: 'none',
                    }} />

                    {/* Corner frames */}
                    <div style={{ position: 'absolute', top: '72px', left: '16px', width: '70px', height: '70px', borderTop: '2px solid rgba(228,185,90,0.25)', borderLeft: '2px solid rgba(228,185,90,0.25)' }} />
                    <div style={{ position: 'absolute', top: '72px', right: '16px', width: '70px', height: '70px', borderTop: '2px solid rgba(228,185,90,0.25)', borderRight: '2px solid rgba(228,185,90,0.25)' }} />
                    <div style={{ position: 'absolute', bottom: '60px', left: '16px', width: '70px', height: '70px', borderBottom: '2px solid rgba(228,185,90,0.1)', borderLeft: '2px solid rgba(228,185,90,0.1)' }} />
                    <div style={{ position: 'absolute', bottom: '60px', right: '16px', width: '70px', height: '70px', borderBottom: '2px solid rgba(228,185,90,0.1)', borderRight: '2px solid rgba(228,185,90,0.1)' }} />

                    {/* Horizontal scan lines */}
                    <div style={{ position: 'absolute', top: '30%', left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 5%, rgba(228,185,90,0.06) 30%, rgba(228,185,90,0.06) 70%, transparent 95%)' }} />
                    <div style={{ position: 'absolute', top: '70%', left: 0, right: 0, height: '1px', background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.04) 30%, rgba(255,255,255,0.04) 70%, transparent 95%)' }} />

                    {/* Film strip marks - left */}
                    <div style={{ position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.2 }}>
                        {[...Array(6)].map((_, i) => <div key={i} style={{ width: '12px', height: '8px', background: 'rgba(228,185,90,0.8)', borderRadius: '1px' }} />)}
                    </div>
                    {/* Film strip marks - right */}
                    <div style={{ position: 'absolute', right: '24px', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.2 }}>
                        {[...Array(6)].map((_, i) => <div key={i} style={{ width: '12px', height: '8px', background: 'rgba(228,185,90,0.8)', borderRadius: '1px' }} />)}
                    </div>

                    {/* Main text content */}
                    <div style={{
                        position: 'relative', zIndex: 2, textAlign: 'center',
                        maxWidth: 'min(760px, 90%)', padding: '0 1.5rem',
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                    }}>
                        {/* Badge */}
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            padding: '6px 18px', borderRadius: 'var(--radius-full)',
                            background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.25)',
                            fontSize: '0.68rem', fontWeight: 700, color: 'var(--accent-gold)',
                            letterSpacing: '0.14em', textTransform: 'uppercase' as const, marginBottom: '20px',
                            backdropFilter: 'blur(8px)',
                        }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-gold)', animation: 'pulse-gold 2s infinite' }} />
                            🎓 {t('label')}
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent-gold)', animation: 'pulse-gold 2s infinite' }} />
                        </div>

                        {/* Title — premium cinematic mixed-font layout */}
                        <div style={{ marginBottom: '36px' }}>
                            {/* Line 1: LEVEL UP — wide cinematic caps (translated) */}
                            <div className="training-title-row" style={{
                                display: 'flex', alignItems: 'baseline', justifyContent: 'center',
                                gap: 'clamp(6px, 1.2vw, 14px)', lineHeight: 1,
                                marginBottom: 'clamp(2px, 0.5vw, 6px)',
                            }}>
                                <span style={{
                                    fontFamily: "'Bebas Neue', 'Impact', sans-serif",
                                    fontSize: 'clamp(3.2rem, 7.5vw, 6.4rem)',
                                    fontWeight: 400,
                                    color: '#fff',
                                    letterSpacing: '0.06em',
                                    lineHeight: 1,
                                    textShadow: '0 6px 40px rgba(0,0,0,0.7)',
                                }}>{t('heroLine1')}</span>
                                {/* Thin gold rule */}
                                <span style={{
                                    display: 'inline-block',
                                    width: 'clamp(18px, 2.5vw, 32px)',
                                    height: '2px',
                                    background: 'linear-gradient(90deg, transparent, rgba(228,185,90,0.7), transparent)',
                                    alignSelf: 'center',
                                    flexShrink: 0,
                                }} />
                            </div>

                            {/* Line 2: your CRAFT — italic serif prefix + gold shimmer (translated) */}
                            <div className="training-title-row-2" style={{
                                display: 'flex', alignItems: 'baseline', justifyContent: 'center',
                                gap: 'clamp(8px, 1.5vw, 18px)', lineHeight: 1,
                            }}>
                                {t('heroLine2') && (
                                    <span style={{
                                        fontFamily: "'Playfair Display', 'Georgia', serif",
                                        fontStyle: 'italic',
                                        fontSize: 'clamp(1.6rem, 3.6vw, 3rem)',
                                        fontWeight: 700,
                                        color: 'rgba(255,255,255,0.75)',
                                        letterSpacing: '-0.01em',
                                        lineHeight: 1,
                                        textShadow: '0 4px 20px rgba(0,0,0,0.6)',
                                    }}>{t('heroLine2')}</span>
                                )}
                                <span
                                    className="craft-shimmer"
                                    style={{
                                        fontFamily: "'Cinzel', 'Playfair Display', serif",
                                        fontSize: 'clamp(2.4rem, 5.5vw, 4.8rem)',
                                        fontWeight: 900,
                                        letterSpacing: '0.04em',
                                        lineHeight: 1,
                                    }}
                                >{t('heroAccent')}</span>
                            </div>
                        </div>

                        {/* Stat pills in hero */}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            {[
                                { value: String(courses.length), label: t('courses'), icon: '📚' },
                                { value: String(totalLessons), label: t('lessons'), icon: '🎬' },
                                { value: String(totalEnrollments), label: t('students'), icon: '👥' },
                            ].map(stat => (
                                <div key={stat.label} style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 16px', borderRadius: '100px',
                                    background: 'rgba(13,15,20,0.5)',
                                    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                                    border: '1px solid rgba(228,185,90,0.18)',
                                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                                }}>
                                    <span style={{ fontSize: '0.85rem' }}>{stat.icon}</span>
                                    <span style={{
                                        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem',
                                        background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                                    }}>{stat.value}</span>
                                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' as const, letterSpacing: '0.1em', fontWeight: 600 }}>{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Scroll indicator */}
                    <div style={{
                        position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                        opacity: 0.6,
                    }}>
                        <span style={{ fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.6)' }}>{t('scroll')}</span>
                        <div style={{ width: '20px', height: '30px', border: '1.5px solid rgba(228,185,90,0.4)', borderRadius: '10px', display: 'flex', justifyContent: 'center', paddingTop: '5px' }}>
                            <div style={{ width: '3px', height: '6px', background: 'var(--accent-gold)', borderRadius: '2px', animation: 'scroll-hint 1.5s ease-in-out infinite' }} />
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── CONTENT: overlaps and scrolls over video ─── */}
            <div style={{ position: 'relative', zIndex: 1 }}>

                {/* Cinematic fade strip */}
                <div style={{
                    height: '120px', marginTop: '-60px',
                    background: 'linear-gradient(180deg, transparent 0%, var(--bg-primary) 100%)',
                    pointerEvents: 'none',
                }} />

                {/* The rest is solid */}
                <div style={{ background: 'var(--bg-primary)', paddingBottom: '5rem' }}>

                    {courses.length === 0 ? (
                        /* ── Empty state ── */
                        <section style={{ maxWidth: '640px', margin: '0 auto', padding: '3rem 1.5rem 6rem' }}>
                            <div style={{
                                borderRadius: '24px', padding: '4rem 3rem', textAlign: 'center',
                                background: 'linear-gradient(135deg, rgba(212,168,83,0.06), rgba(168,85,247,0.04), rgba(59,130,246,0.04))',
                                border: '1px solid rgba(212,168,83,0.14)',
                                position: 'relative', overflow: 'hidden',
                            }}>
                                <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,83,0.08), transparent)', pointerEvents: 'none' }} />
                                <div style={{ fontSize: '3.5rem', marginBottom: '20px', animation: 'float 4s ease-in-out infinite' }}>📚</div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: 900, marginBottom: '12px', fontFamily: 'var(--font-display)' }}>{t('coursesComingSoon')}</h2>
                                <p style={{ color: 'var(--text-tertiary)', lineHeight: 1.8, fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 28px' }}>
                                    {isLoggedIn ? t('noCoursesLoggedIn') : t('noCoursesGuest')}
                                </p>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap', marginBottom: isLoggedIn ? '0' : '28px' }}>
                                    {[{ icon: '🎬', text: t('featFilmmaking') }, { icon: '🎭', text: t('featActing') }, { icon: '🤖', text: t('featAI') }].map(f => (
                                        <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.6 }}>
                                            <span style={{ fontSize: '1.3rem' }}>{f.icon}</span>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{f.text}</span>
                                        </div>
                                    ))}
                                </div>
                                {!isLoggedIn && (
                                    <Link href="/register" style={{
                                        display: 'inline-block', padding: '14px 36px', borderRadius: 'var(--radius-full)',
                                        background: 'linear-gradient(135deg, var(--accent-gold), #e8c356)',
                                        color: '#0a0a0a', fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none',
                                        boxShadow: '0 6px 24px rgba(212,168,83,0.3)',
                                    }}>{t('createAccount')}</Link>
                                )}
                            </div>
                        </section>
                    ) : (
                        <>
                            {/* ── Category filter bar ── */}
                            <div style={{ padding: '0 1.5rem 2.5rem', display: 'flex', justifyContent: 'center' }}>
                                <div style={{
                                    display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center',
                                    padding: '8px', borderRadius: '100px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    backdropFilter: 'blur(12px)',
                                }}>
                                    {categories.map(cat => {
                                        const meta = cat === 'all' ? null : CAT_META[cat]
                                        const isActive = activeFilter === cat
                                        return (
                                            <button
                                                key={cat}
                                                className="filter-pill"
                                                onClick={() => setActiveFilter(cat)}
                                                style={{
                                                    padding: '6px 16px', borderRadius: '100px',
                                                    border: isActive ? `1px solid ${meta?.color || 'rgba(228,185,90,0.4)'}` : '1px solid transparent',
                                                    background: isActive ? `${meta?.color || 'rgba(228,185,90,0.15)'}18` : 'transparent',
                                                    color: isActive ? (meta?.color || 'var(--accent-gold)') : 'var(--text-secondary)',
                                                    fontSize: '0.75rem', fontWeight: 700,
                                                    letterSpacing: '0.05em', textTransform: 'uppercase' as const,
                                                    cursor: 'pointer',
                                                    boxShadow: isActive ? `0 0 12px ${meta?.color || 'rgba(228,185,90,0.2)'}22` : 'none',
                                                }}
                                            >
                                                {meta ? `${meta.icon} ${t(meta.tKey)}` : `✦ ${t('filterAll')}`}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* ── Course Grid ── */}
                            <section style={{
                                maxWidth: '1160px', margin: '0 auto', padding: '0 1.5rem 4rem',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                                gap: '28px',
                            }}>
                                {filtered.map(course => {
                                    const cat = CAT_META[course.category] || { icon: '🌟', color: '#d4a853', tKey: 'catGeneral' }
                                    const lessonCount = course.modules.reduce((s, m) => s + m.lessons.length, 0)
                                    const totalMin = course.modules.reduce((s, m) => s + m.lessons.reduce((ls, l) => ls + (l.duration || 0), 0), 0)
                                    const lvlColor = LEVEL_COLORS[course.level] || '#3b82f6'

                                    return (
                                        <Link key={course.id} href={`/training/${course.slug}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                                            <div className="course-card" style={{
                                                background: 'var(--bg-secondary)',
                                                borderRadius: '20px', overflow: 'hidden',
                                                position: 'relative', cursor: 'pointer',
                                                border: `1px solid ${cat.color}18`,
                                                boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 0 0 ${cat.color}`,
                                            }}>
                                                {/* Thumbnail or color band */}
                                                <div style={{
                                                    height: '180px', overflow: 'hidden',
                                                    background: course.thumbnail
                                                        ? `url(${course.thumbnail}) center/cover`
                                                        : `linear-gradient(135deg, ${cat.color}18 0%, ${cat.color}06 100%)`,
                                                    position: 'relative',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    {!course.thumbnail && (
                                                        <span style={{ fontSize: '4rem', opacity: 0.35 }}>{cat.icon}</span>
                                                    )}
                                                    {/* Color accent bar at bottom of thumbnail */}
                                                    <div style={{
                                                        position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px',
                                                        background: `linear-gradient(90deg, ${cat.color}, transparent)`,
                                                    }} />
                                                    {/* Level badge */}
                                                    <div style={{
                                                        position: 'absolute', top: '12px', right: '12px',
                                                        padding: '3px 10px', borderRadius: '100px',
                                                        background: `${lvlColor}22`, border: `1px solid ${lvlColor}44`,
                                                        fontSize: '0.58rem', fontWeight: 800, color: lvlColor,
                                                        textTransform: 'uppercase' as const, letterSpacing: '0.1em',
                                                        backdropFilter: 'blur(6px)',
                                                    }}>{t(LEVEL_KEYS[course.level] || 'levelBeginner')}</div>
                                                </div>

                                                <div style={{ padding: '20px 22px 22px' }}>
                                                    {/* Category chip */}
                                                    <div style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                        marginBottom: '10px', padding: '3px 10px', borderRadius: '100px',
                                                        background: `${cat.color}12`, border: `1px solid ${cat.color}22`,
                                                        fontSize: '0.65rem', fontWeight: 700, color: cat.color,
                                                        letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                                                    }}>
                                                        {cat.icon} {t(cat.tKey)}
                                                    </div>

                                                    <h3 style={{
                                                        fontSize: '1.15rem', fontWeight: 800, lineHeight: 1.25,
                                                        marginBottom: '8px', fontFamily: 'var(--font-display)',
                                                    }}>{tr(course.translations, 'title', course.title)}</h3>

                                                    <p style={{
                                                        fontSize: '0.82rem', color: 'var(--text-tertiary)',
                                                        lineHeight: 1.6, marginBottom: '18px',
                                                        display: '-webkit-box', WebkitLineClamp: 2,
                                                        WebkitBoxOrient: 'vertical' as const, overflow: 'hidden',
                                                    }}>{tr(course.translations, 'description', course.description)}</p>

                                                    {/* Meta row */}
                                                    <div style={{
                                                        display: 'flex', gap: '14px', alignItems: 'center',
                                                        paddingTop: '14px',
                                                        borderTop: `1px solid ${cat.color}14`,
                                                    }}>
                                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            📦 <strong style={{ color: 'var(--text-secondary)' }}>{course.modules.length}</strong> {t('modules')}
                                                        </span>
                                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            📚 <strong style={{ color: 'var(--text-secondary)' }}>{lessonCount}</strong> {t('lessons')}
                                                        </span>
                                                        {totalMin > 0 && (
                                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                ⏱️ <strong style={{ color: 'var(--text-secondary)' }}>{fmtDuration(totalMin)}</strong>
                                                            </span>
                                                        )}
                                                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ fontSize: '0.7rem', color: cat.color, fontWeight: 700 }}>{t('enrollCta')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    )
                                })}
                            </section>

                            {/* ── CTA ── */}
                            <section style={{ maxWidth: '960px', margin: '0 auto', padding: '0 1.5rem 5rem' }}>
                                <div style={{
                                    position: 'relative', borderRadius: '28px', padding: '4rem',
                                    overflow: 'hidden', textAlign: 'center',
                                    background: 'linear-gradient(135deg, rgba(212,168,83,0.07) 0%, rgba(168,85,247,0.05) 50%, rgba(59,130,246,0.05) 100%)',
                                    border: '1px solid rgba(212,168,83,0.14)',
                                }}>
                                    {/* Decorative orbs */}
                                    <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '250px', height: '250px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(212,168,83,0.1), transparent)', pointerEvents: 'none' }} />
                                    <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.08), transparent)', pointerEvents: 'none' }} />

                                    <div style={{ fontSize: '3rem', marginBottom: '16px', animation: 'float 3s ease-in-out infinite' }}>🚀</div>
                                    <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: '12px', fontFamily: 'var(--font-display)' }}>
                                        {isLoggedIn ? t('diveIn') : t('readyToLearn')}
                                    </h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '460px', margin: '0 auto 32px', lineHeight: 1.7 }}>
                                        {isLoggedIn ? t('pickCourse') : t('trackProgress')}
                                    </p>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2.5rem', flexWrap: 'wrap', marginBottom: isLoggedIn ? '0' : '32px' }}>
                                        {[{ icon: '🎯', text: t('ctaTrackProgress') }, { icon: '🏆', text: t('earnBadges') }, { icon: '📜', text: t('getCertified') }].map(f => (
                                            <div key={f.text} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '1.5rem' }}>{f.icon}</span>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>{f.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {!isLoggedIn && (
                                        <Link href="/register" style={{
                                            display: 'inline-block', padding: '14px 44px', borderRadius: 'var(--radius-full)',
                                            background: 'linear-gradient(135deg, var(--accent-gold), #e8c356)',
                                            color: '#0a0a0a', fontWeight: 800, fontSize: '0.95rem', textDecoration: 'none',
                                            boxShadow: '0 8px 28px rgba(212,168,83,0.3)',
                                        }}>{t('createAccount')}</Link>
                                    )}
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
