'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

/* ── Types ── */
type Lesson = {
    id?: string; title: string; contentType: string
    contentUrl: string; uploadPath: string; description: string
    duration: string; sortOrder: number
}
type Module = {
    id?: string; title: string; description: string
    sortOrder: number; lessons: Lesson[]
}
type Course = {
    id: string; title: string; slug: string; description: string
    thumbnail: string | null; category: string; level: string
    published: boolean; sortOrder: number; translations: string | null
    modules: Module[]; enrollments: { id: string; completedAt: string | null }[]
    totalModules: number; totalLessons: number; totalDuration: number
    enrollmentCount: number; completedCount: number
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

// Content types available for reference (used in course editor)
const _CONTENT_TYPES = [
    { value: 'video', label: '🎥 Video' },
    { value: 'document', label: '📄 Document' },
    { value: 'link', label: '🔗 External Link' },
    { value: 'quiz', label: '📝 Quiz' },
]

const SIDEBAR_LINKS = [
    { href: '/admin/analytics', label: '📊 Analytics' },
    { href: '/admin/projects', label: '🎬 Projects' },
    { href: '/admin/casting', label: '🎭 Casting' },
    { href: '/admin/applications', label: '📋 Applications' },
    { href: '/admin/media', label: '🖼️ Page Media' },
    { href: '/admin/sponsors', label: '🤝 Sponsors' },
    { href: '/admin/donations', label: '💰 Donations' },
    { href: '/admin/users', label: '👥 Users' },
    { href: '/admin/scripts', label: '✍️ Scripts' },
    { href: '/admin/training', label: '🎓 Training', active: true },
    { href: '/admin/settings', label: '⚙️ Settings' },
]

const emptyLesson = (): Lesson => ({
    title: '', contentType: 'video', contentUrl: '', uploadPath: '',
    description: '', duration: '', sortOrder: 0,
})

const _emptyModule = (): Module => ({
    title: '', description: '', sortOrder: 0, lessons: [emptyLesson()],
})

export default function AdminTrainingPage() {
    const router = useRouter()
    const [courses, setCourses] = useState<Course[]>([])
    const [loading, setLoading] = useState(true)
    const [_error, setError] = useState('')
    const [filter, setFilter] = useState('all')

    const loadCourses = useCallback(() => {
        setLoading(true)
        fetch('/api/admin/training')
            .then(r => { if (r.status === 401) { window.location.href = '/admin/login'; return [] } return r.json() })
            .then(data => setCourses(data))
            .catch(() => setError('Failed to load courses'))
            .finally(() => setLoading(false))
    }, [])

    useEffect(() => { loadCourses() }, [loadCourses])

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this course and all its modules/lessons? This cannot be undone.')) return
        try {
            await fetch(`/api/admin/training/${id}`, { method: 'DELETE' })
            setCourses(prev => prev.filter(c => c.id !== id))
        } catch { alert('Failed to delete') }
    }

    const togglePublish = async (course: Course) => {
        try {
            await fetch(`/api/admin/training/${course.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...course, published: !course.published, modules: course.modules }),
            })
            loadCourses()
        } catch { alert('Failed to toggle publish') }
    }

    const filtered = filter === 'all' ? courses : courses.filter(c => c.category === filter)
    const totalEnrollments = courses.reduce((s, c) => s + c.enrollmentCount, 0)
    const totalCompletions = courses.reduce((s, c) => s + c.completedCount, 0)
    const publishedCount = courses.filter(c => c.published).length

    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <div className="admin-sidebar-logo">
                    <Link href="/" style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800 }}>
                        <span style={{ color: 'var(--accent-gold)' }}>AIM</span> Studio
                    </Link>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>Admin Panel</div>
                </div>
                <ul className="admin-sidebar-nav">
                    {SIDEBAR_LINKS.map(link => (
                        <li key={link.href}>
                            <Link href={link.href} className={link.active ? 'active' : ''}>{link.label}</Link>
                        </li>
                    ))}
                    <li style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 'var(--space-md)', paddingTop: 'var(--space-md)' }}>
                        <Link href="/" style={{ color: 'var(--text-tertiary)' }}>← Back to Site</Link>
                    </li>
                </ul>
            </aside>

            <main className="admin-main">
                <div className="admin-header">
                    <h1 className="admin-page-title">🎓 Training Hub</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>{courses.length} courses</span>
                        <button onClick={() => router.push('/admin/training/new/edit')} className="btn btn-primary btn-sm">+ New Course</button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid-4" style={{ marginBottom: 'var(--space-2xl)' }}>
                    <div className="stat-card">
                        <div className="stat-card-label">Total Courses</div>
                        <div className="stat-card-value">{courses.length}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-label">Published</div>
                        <div className="stat-card-value" style={{ color: 'var(--success)' }}>{publishedCount}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-label">Enrollments</div>
                        <div className="stat-card-value" style={{ color: 'var(--accent-gold)' }}>{totalEnrollments}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-card-label">Completions</div>
                        <div className="stat-card-value">{totalCompletions}</div>
                    </div>
                </div>

                {/* Category Filter */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: 'var(--space-xl)', flexWrap: 'wrap' }}>
                    <button onClick={() => setFilter('all')} style={{
                        padding: '5px 14px', fontSize: '0.72rem', fontWeight: 600, borderRadius: '20px',
                        border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                        background: filter === 'all' ? 'var(--accent-gold)' : 'rgba(255,255,255,0.05)',
                        color: filter === 'all' ? '#0a0a0a' : 'var(--text-secondary)',
                    }}>All</button>
                    {CATEGORIES.map(cat => (
                        <button key={cat.value} onClick={() => setFilter(cat.value)} style={{
                            padding: '5px 14px', fontSize: '0.72rem', fontWeight: 600, borderRadius: '20px',
                            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                            background: filter === cat.value ? `${cat.color}20` : 'rgba(255,255,255,0.05)',
                            color: filter === cat.value ? cat.color : 'var(--text-secondary)',
                        }}>{cat.label}</button>
                    ))}
                </div>

                {/* Course List */}
                {loading ? (
                    <div style={{ padding: 'var(--space-4xl)', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        <div className="loading-spinner" style={{ margin: '0 auto var(--space-md)' }} />
                        Loading courses...
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: 'var(--space-4xl) var(--space-2xl)', textAlign: 'center', color: 'var(--text-tertiary)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🎓</div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>No courses yet</h3>
                        <p style={{ margin: '4px 0 16px', fontSize: '0.85rem' }}>Create your first course to start training.</p>
                        <button onClick={() => router.push('/admin/training/new/edit')} className="btn btn-primary">+ Create Course</button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
                        {filtered.map(course => {
                            const cat = CATEGORIES.find(c => c.value === course.category) || CATEGORIES[0]
                            const lvl = LEVELS.find(l => l.value === course.level) || LEVELS[0]
                            const completionRate = course.enrollmentCount > 0
                                ? Math.round((course.completedCount / course.enrollmentCount) * 100) : 0

                            return (
                                <div key={course.id} style={{
                                    background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '14px', overflow: 'hidden', transition: 'all 0.3s',
                                    position: 'relative',
                                }}>
                                    <div style={{ height: '3px', background: `linear-gradient(90deg, ${cat.color}, transparent)` }} />
                                    <div style={{ padding: '20px' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '1.6rem' }}>{cat.label.split(' ')[0]}</span>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                                                        {course.title}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                                                        <span style={{
                                                            fontSize: '0.55rem', fontWeight: 700, padding: '1px 8px',
                                                            borderRadius: '10px', background: `${lvl.color}15`, color: lvl.color,
                                                            textTransform: 'uppercase', letterSpacing: '0.06em',
                                                        }}>{lvl.label}</span>
                                                        <span style={{
                                                            fontSize: '0.55rem', fontWeight: 700, padding: '1px 8px',
                                                            borderRadius: '10px',
                                                            background: course.published ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.08)',
                                                            color: course.published ? '#34d399' : '#ef4444',
                                                            textTransform: 'uppercase', letterSpacing: '0.06em',
                                                        }}>{course.published ? 'PUBLISHED' : 'DRAFT'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <p style={{
                                            fontSize: '0.78rem', color: 'var(--text-tertiary)', lineHeight: 1.5,
                                            marginBottom: '14px', display: '-webkit-box', WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                        }}>{course.description || 'No description yet.'}</p>

                                        <div style={{
                                            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px',
                                            padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.04)',
                                            borderBottom: '1px solid rgba(255,255,255,0.04)', marginBottom: '14px',
                                        }}>
                                            {[
                                                { label: 'Modules', value: course.totalModules, icon: '📦' },
                                                { label: 'Lessons', value: course.totalLessons, icon: '📚' },
                                                { label: 'Enrolled', value: course.enrollmentCount, icon: '👥' },
                                                { label: 'Complete', value: `${completionRate}%`, icon: '✅' },
                                            ].map(stat => (
                                                <div key={stat.label} style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{stat.value}</div>
                                                    <div style={{ fontSize: '0.55rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <button onClick={() => router.push(`/admin/training/${course.id}/edit`)} style={{
                                                flex: 1, padding: '7px', fontSize: '0.74rem', fontWeight: 600,
                                                border: 'none', borderRadius: '8px', cursor: 'pointer',
                                                background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)',
                                            }}>✏️ Edit</button>
                                            <button onClick={() => togglePublish(course)} style={{
                                                flex: 1, padding: '7px', fontSize: '0.74rem', fontWeight: 600,
                                                border: 'none', borderRadius: '8px', cursor: 'pointer',
                                                background: course.published ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.08)',
                                                color: course.published ? '#ef4444' : '#34d399',
                                            }}>{course.published ? '📴 Unpublish' : '🚀 Publish'}</button>
                                            <button onClick={() => handleDelete(course.id)} style={{
                                                padding: '7px 10px', fontSize: '0.74rem', fontWeight: 600,
                                                border: 'none', borderRadius: '8px', cursor: 'pointer',
                                                background: 'transparent', color: 'rgba(239,68,68,0.5)',
                                            }}>🗑️</button>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </main>
        </div>
    )
}
