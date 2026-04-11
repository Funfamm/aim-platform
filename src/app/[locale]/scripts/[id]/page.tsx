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
                    from { opacity: 0; transform: translateY(16px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes shimmer {
                    0%   { background-position: -200% center; }
                    100% { background-position:  200% center; }
                }
                @keyframes glowPulse {
                    0%, 100% { box-shadow: 0 0 20px rgba(212,168,83,0.06), 0 8px 32px rgba(0,0,0,0.4); }
                    50%       { box-shadow: 0 0 40px rgba(212,168,83,0.14), 0 8px 32px rgba(0,0,0,0.4); }
                }

                .d0 { animation: fadeInUp 0.45s ease both; }
                .d1 { animation: fadeInUp 0.45s ease 0.08s both; }
                .d2 { animation: fadeInUp 0.45s ease 0.16s both; }
                .d3 { animation: fadeInUp 0.45s ease 0.24s both; }
                .d4 { animation: fadeInUp 0.45s ease 0.32s both; }

                .back-btn {
                    display: inline-flex; align-items: center; gap: 6px;
                    font-size: 0.68rem; font-weight: 700; letter-spacing: 0.06em;
                    text-transform: uppercase; color: var(--text-tertiary);
                    text-decoration: none;
                    padding: 6px 14px; border-radius: 8px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.07);
                    transition: all 0.2s;
                }
                .back-btn:hover { color: var(--accent-gold); border-color: rgba(212,168,83,0.2); }

                .tag-gold    { font-size: 0.65rem; padding: 4px 12px; font-weight: 600; background: rgba(212,168,83,0.08); color: var(--accent-gold); border-radius: 6px; border: 1px solid rgba(212,168,83,0.2); }
                .tag-blue    { font-size: 0.65rem; padding: 4px 12px; font-weight: 600; background: rgba(96,165,250,0.08); color: #60a5fa; border-radius: 6px; border: 1px solid rgba(96,165,250,0.15); }
                .tag-rose    { font-size: 0.65rem; padding: 4px 12px; font-weight: 600; background: rgba(244,63,94,0.07); color: #f43f5e; border-radius: 6px; border: 1px solid rgba(244,63,94,0.15); }
                .tag-neutral { font-size: 0.65rem; padding: 4px 11px; background: rgba(255,255,255,0.03); color: var(--text-secondary); border-radius: 6px; border: 1px solid var(--border-subtle); }

                .info-card {
                    background: linear-gradient(145deg, rgba(12,12,18,0.9), rgba(8,8,14,0.82));
                    border: 1px solid rgba(212,168,83,0.12);
                    border-radius: 14px;
                    padding: 18px 20px;
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    box-shadow: 0 6px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04);
                }

                .form-card {
                    background: rgba(255,255,255,0.025);
                    border: 1px solid rgba(212,168,83,0.18);
                    border-radius: 20px;
                    backdrop-filter: blur(24px);
                    -webkit-backdrop-filter: blur(24px);
                    overflow: hidden;
                    animation: glowPulse 4s ease-in-out infinite;
                }

                .meta-row {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
                    font-size: 0.8rem;
                }
                .meta-row:last-child { border-bottom: none; padding-bottom: 0; }
                .meta-label { color: var(--text-tertiary); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.07em; }
                .meta-value { color: var(--text-primary); font-weight: 600; text-align: right; }

                /* ── Mobile layout ── */
                .detail-layout {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                /* ── Tablet+ ── */
                @media (min-width: 900px) {
                    .detail-layout {
                        display: grid;
                        grid-template-columns: 1fr 400px;
                        gap: 28px;
                        align-items: start;
                    }
                    .form-card {
                        position: sticky;
                        top: 96px;
                    }
                }
            `}</style>

            <main style={{ minHeight: '100vh', paddingTop: '68px', background: 'transparent', position: 'relative', zIndex: 2 }}>

                {/* ── Hero strip ── */}
                <div style={{
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: 'linear-gradient(180deg, rgba(13,15,20,0.75) 0%, rgba(13,15,20,0.5) 100%)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    padding: '28px 20px 24px',
                }}>
                    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>

                        {/* Back button */}
                        <a href="/scripts" className="back-btn d0" style={{ marginBottom: '16px' }}>
                            <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>←</span> {t('backToScripts')}
                        </a>

                        {/* Project pill */}
                        {call.project && (
                            <div className="d0" style={{
                                display: 'inline-flex', alignItems: 'center', gap: '7px',
                                marginBottom: '12px',
                                fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.1em',
                                textTransform: 'uppercase', color: 'var(--accent-gold)',
                                background: 'rgba(212,168,83,0.07)',
                                padding: '4px 14px', borderRadius: '99px',
                                border: '1px solid rgba(212,168,83,0.18)',
                            }}>
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-gold)', display: 'inline-block' }} />
                                {call.project.title}
                            </div>
                        )}

                        <h1 className="d1" style={{
                            fontSize: 'clamp(1.6rem, 5.5vw, 2.8rem)',
                            fontWeight: 800, lineHeight: 1.1,
                            marginBottom: '14px',
                            background: 'linear-gradient(135deg, #e8e6e3 30%, #d4a853)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                            letterSpacing: '-0.02em',
                        }}>
                            {call.title}
                        </h1>

                        {/* Tags row */}
                        <div className="d2" style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                            {call.genre && <span className="tag-gold">🎬 {call.genre}</span>}
                            {call.targetLength && <span className="tag-blue">⏱ {call.targetLength}</span>}
                            {call.deadline && <span className="tag-rose">📅 {call.deadline}</span>}
                            <span className="tag-neutral">📄 {call._count.submissions} submission{call._count.submissions !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                </div>

                {/* ── Main content ── */}
                <section style={{ padding: '20px 16px 80px' }}>
                    <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
                        <div className="detail-layout">

                            {/* LEFT — Info cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

                                {/* About */}
                                <div className="info-card d2">
                                    <div style={{
                                        fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em',
                                        textTransform: 'uppercase', color: 'var(--accent-gold)', marginBottom: '10px',
                                    }}>
                                        {t('aboutCall')}
                                    </div>
                                    <p style={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>
                                        {call.description}
                                    </p>
                                </div>

                                {/* Tone */}
                                {toneList.length > 0 && (
                                    <div className="info-card d3" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                                        <div style={{
                                            fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em',
                                            textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: '10px',
                                        }}>
                                            {t('desiredTone')}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                                            {toneList.map((tone: string) => (
                                                <span key={tone} className="tag-neutral">{tone}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Submission details */}
                                <div className="info-card d4">
                                    <div style={{
                                        fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.12em',
                                        textTransform: 'uppercase', color: 'var(--accent-gold)', marginBottom: '12px',
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
                                                fontSize: '0.65rem', fontWeight: 700,
                                                color: '#10b981', background: 'rgba(16,185,129,0.08)',
                                                padding: '3px 10px', borderRadius: '6px',
                                                border: '1px solid rgba(16,185,129,0.2)',
                                            }}>● {t('statusOpen')}</span>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* RIGHT — Form */}
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
                                    <div className="form-card d1">
                                        <div style={{
                                            padding: '22px 22px 16px',
                                            background: 'linear-gradient(135deg, rgba(212,168,83,0.06), transparent)',
                                            borderBottom: '1px solid rgba(212,168,83,0.1)',
                                        }}>
                                            <div style={{
                                                fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em',
                                                textTransform: 'uppercase', color: 'var(--accent-gold)',
                                                marginBottom: '6px',
                                            }}>
                                                {t('submitYourScript')}
                                            </div>
                                            <div style={{
                                                fontSize: '1.05rem', fontWeight: 800,
                                                color: 'var(--text-primary)', lineHeight: 1.25,
                                                letterSpacing: '-0.01em',
                                            }}>
                                                {call.title}
                                            </div>
                                        </div>
                                        <div style={{ padding: '22px 22px 28px' }}>
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
