import { notFound, redirect } from 'next/navigation'
import Footer from '@/components/Footer'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import ScriptSubmissionForm from '@/components/ScriptSubmissionForm'
import ScriptVideoBackground from '@/components/scripts/ScriptVideoBackground'
import ScriptSubmittedCard from '@/components/scripts/ScriptSubmittedCard'
import { getLocale, getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const call = await prisma.scriptCall.findUnique({ where: { id } })
    if (!call) return { title: 'Not Found' }
    return {
        title: `${call.title} | Script Call | AIM Studio`,
        description: call.description.slice(0, 160),
    }
}

export default async function ScriptCallDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const session = await getUserSession()
    if (!session) {
        const locale = await getLocale()
        redirect(`/${locale}/login?redirect=/scripts/${id}`)
    }

    const t = await getTranslations('scripts')

    const call = await prisma.scriptCall.findUnique({
        where: { id },
        include: {
            project: { select: { title: true, slug: true, coverImage: true } },
            _count: { select: { submissions: true } },
        },
    })

    if (!call || !call.isPublic || call.status !== 'open') notFound()

    // ── Check if user already submitted ──
    const user = await prisma.user.findUnique({
        where: { id: session.userId as string },
        select: { email: true },
    })

    let existingSubmission: { id: string; status: string; title: string; createdAt: Date } | null = null
    if (user?.email) {
        existingSubmission = await prisma.scriptSubmission.findFirst({
            where: { scriptCallId: id, authorEmail: user.email },
            select: { id: true, status: true, title: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        })
    }

    const toneList = call.toneKeywords?.split(',').map((t: string) => t.trim()).filter(Boolean) || []

    return (
        <>
            <ScriptVideoBackground />
            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes shimmer {
                    0%   { background-position: -200% center; }
                    100% { background-position:  200% center; }
                }
                @keyframes glow-pulse {
                    0%, 100% { box-shadow: 0 0 20px rgba(212,168,83,0.08); }
                    50%       { box-shadow: 0 0 40px rgba(212,168,83,0.18); }
                }
                .detail-fade { animation: fadeInUp 0.55s ease both; }
                .detail-fade-1 { animation: fadeInUp 0.55s ease 0.1s both; }
                .detail-fade-2 { animation: fadeInUp 0.55s ease 0.2s both; }
                .detail-fade-3 { animation: fadeInUp 0.55s ease 0.3s both; }
                .detail-fade-4 { animation: fadeInUp 0.55s ease 0.4s both; }

                .tag-gold {
                    font-size: 0.68rem; padding: 4px 14px; font-weight: 600;
                    background: rgba(212,168,83,0.08); color: var(--accent-gold);
                    border-radius: var(--radius-full); border: 1px solid rgba(212,168,83,0.2);
                }
                .tag-blue {
                    font-size: 0.68rem; padding: 4px 14px; font-weight: 600;
                    background: rgba(96,165,250,0.08); color: #60a5fa;
                    border-radius: var(--radius-full); border: 1px solid rgba(96,165,250,0.15);
                }
                .tag-rose {
                    font-size: 0.68rem; padding: 4px 14px; font-weight: 600;
                    background: rgba(244,63,94,0.07); color: #f43f5e;
                    border-radius: var(--radius-full); border: 1px solid rgba(244,63,94,0.15);
                }
                .tag-neutral {
                    font-size: 0.68rem; padding: 4px 12px;
                    background: rgba(255,255,255,0.03); color: var(--text-secondary);
                    border-radius: var(--radius-full); border: 1px solid var(--border-subtle);
                }
                .form-card {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(212,168,83,0.18);
                    border-radius: 20px;
                    backdrop-filter: blur(24px);
                    position: sticky;
                    top: 100px;
                    animation: glow-pulse 4s ease-in-out infinite;
                    overflow: hidden;
                }
                .form-card-header {
                    padding: 28px 32px 20px;
                    background: linear-gradient(135deg, rgba(212,168,83,0.06), transparent);
                    border-bottom: 1px solid rgba(212,168,83,0.1);
                }
                .form-card-body { padding: 28px 32px 32px; }
                .meta-row {
                    display: flex; align-items: center; gap: 10px;
                    padding: 12px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    font-size: 0.85rem;
                }
                .meta-row:last-child { border-bottom: none; }
                .meta-label { color: var(--text-tertiary); min-width: 100px; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; }
                .meta-value { color: var(--text-primary); font-weight: 600; }
                @media (max-width: 900px) {
                    .detail-grid { grid-template-columns: 1fr !important; }
                    .form-card { position: static !important; }
                }
            `}</style>

            <main style={{ minHeight: '100vh', paddingTop: '90px', background: 'transparent', position: 'relative', zIndex: 2 }}>

                {/* ── Hero strip ── */}
                <div style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: 'linear-gradient(180deg, rgba(13,15,20,0.7) 0%, rgba(13,15,20,0.5) 100%)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    padding: '52px 0 44px',
                }}>
                    <div className="container" style={{ maxWidth: '1080px' }}>

                        {/* Breadcrumb project pill */}
                        {call.project && (
                            <div className="detail-fade" style={{
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                marginBottom: '20px',
                                fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em',
                                textTransform: 'uppercase', color: 'var(--accent-gold)',
                                background: 'rgba(212,168,83,0.07)',
                                padding: '5px 16px', borderRadius: 'var(--radius-full)',
                                border: '1px solid rgba(212,168,83,0.18)',
                            }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-gold)', display: 'inline-block' }} />
                                {call.project.title}
                            </div>
                        )}

                        <h1 className="detail-fade-1" style={{
                            fontSize: 'clamp(2rem, 5vw, 3rem)',
                            fontWeight: 800, lineHeight: 1.1,
                            marginBottom: '18px',
                            background: 'linear-gradient(135deg, #e8e6e3 30%, #d4a853)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        }}>
                            {call.title}
                        </h1>

                        {/* Tags row */}
                        <div className="detail-fade-2" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {call.genre && <span className="tag-gold">🎬 {call.genre}</span>}
                            {call.targetLength && <span className="tag-blue">⏱ {call.targetLength}</span>}
                            {call.deadline && <span className="tag-rose">📅 Deadline: {call.deadline}</span>}
                            <span className="tag-neutral">📄 {call._count.submissions} submission{call._count.submissions !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                </div>

                {/* ── Main grid ── */}
                <section style={{ padding: '52px 0 80px' }}>
                    <div className="container" style={{ maxWidth: '1080px' }}>
                        <div className="detail-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 420px',
                            gap: '48px',
                            alignItems: 'start',
                        }}>

                            {/* LEFT — Details */}
                            <div>
                                {/* Description */}
                                <div className="detail-fade-2" style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '16px',
                                    padding: '32px',
                                    marginBottom: '28px',
                                }}>
                                    <div style={{
                                        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
                                        textTransform: 'uppercase', color: 'var(--accent-gold)',
                                        marginBottom: '14px',
                                    }}>
                                    {t('aboutCall')}
                                    </div>
                                    <p style={{
                                        fontSize: '1.05rem', lineHeight: 1.85,
                                        color: 'var(--text-secondary)', margin: 0,
                                    }}>
                                        {call.description}
                                    </p>
                                </div>

                                {/* Tone keywords */}
                                {toneList.length > 0 && (
                                    <div className="detail-fade-3" style={{
                                        background: 'rgba(255,255,255,0.02)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        borderRadius: '16px',
                                        padding: '28px 32px',
                                        marginBottom: '28px',
                                    }}>
                                        <div style={{
                                            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
                                            textTransform: 'uppercase', color: 'var(--text-tertiary)',
                                            marginBottom: '14px',
                                        }}>
                                        {t('desiredTone')}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {toneList.map((tone: string) => (
                                                <span key={tone} className="tag-neutral">{tone}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Submission details table */}
                                <div className="detail-fade-4" style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '16px',
                                    padding: '28px 32px',
                                }}>
                                    <div style={{
                                        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
                                        textTransform: 'uppercase', color: 'var(--accent-gold)',
                                        marginBottom: '18px',
                                    }}>
                                    {t('submissionDetails')}
                                    </div>
                                    <div>
                                        {call.genre && (
                                            <div className="meta-row">
                                                <span className="meta-label">{t('genreLabel')}</span>
                                                <span className="meta-value">{call.genre}</span>
                                            </div>
                                        )}
                                        {call.targetLength && (
                                            <div className="meta-row">
                                                <span className="meta-label">{t('lengthLabel')}</span>
                                                <span className="meta-value">{call.targetLength}</span>
                                            </div>
                                        )}
                                        {call.deadline && (
                                            <div className="meta-row">
                                                <span className="meta-label">{t('deadlineLabel')}</span>
                                                <span className="meta-value" style={{ color: '#f43f5e' }}>{call.deadline}</span>
                                            </div>
                                        )}
                                        <div className="meta-row">
                                            <span className="meta-label">{t('submissions')}</span>
                                            <span className="meta-value">{call._count.submissions} {t('submissionsReceived')}</span>
                                        </div>
                                        <div className="meta-row">
                                            <span className="meta-label">{t('statusLabel')}</span>
                                            <span style={{
                                                fontSize: '0.72rem', fontWeight: 700,
                                                color: '#10b981', background: 'rgba(16,185,129,0.08)',
                                                padding: '3px 12px', borderRadius: 'var(--radius-full)',
                                                border: '1px solid rgba(16,185,129,0.2)',
                                            }}>● {t('statusOpen')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT — Form or Submitted Card */}
                            <div>
                                {existingSubmission && existingSubmission.status !== 'withdrawn' ? (
                                    <ScriptSubmittedCard
                                        callId={id}
                                        callTitle={call.title}
                                        submissionTitle={existingSubmission.title}
                                        submissionStatus={existingSubmission.status}
                                        submittedAt={existingSubmission.createdAt.toISOString()}
                                    />
                                ) : (
                                    <div className="form-card detail-fade-1">
                                        <div className="form-card-header">
                                            <div style={{
                                                fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em',
                                                textTransform: 'uppercase', color: 'var(--accent-gold)',
                                                marginBottom: '8px',
                                            }}>
                                                {t('submitYourScript')}
                                            </div>
                                            <div style={{
                                                fontSize: '1.15rem', fontWeight: 700,
                                                color: 'var(--text-primary)', lineHeight: 1.3,
                                            }}>
                                                {call.title}
                                            </div>
                                        </div>
                                        <div className="form-card-body">
                                            <ScriptSubmissionForm callId={call.id} />
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </section>

            </main>
            <Footer />
        </>
    )
}
