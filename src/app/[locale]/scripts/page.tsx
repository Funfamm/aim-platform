import Link from 'next/link'
import Footer from '@/components/Footer'
import CinematicBackground from '@/components/CinematicBackground'
import NotifyMeButton from '@/components/scripts/NotifyMeButton'
import NotifyNewCallsButton from '@/components/scripts/NotifyNewCallsButton'
import ScriptVideoBackground from '@/components/scripts/ScriptVideoBackground'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
    const t = await getTranslations('scripts')
    return {
        title: t('metaTitle'),
        description: t('metaDesc'),
    }
}

export default async function ScriptCallsPage() {
    const session = await getUserSession()
    const locale = await getLocale()
    if (!session) redirect(`/${locale}/login?redirect=/scripts`)

    const t = await getTranslations('scripts')

    let settings = null
    try { settings = await prisma.siteSettings.findFirst() } catch { /* schema drift */ }
    const enabled = settings?.scriptCallsEnabled ?? false

    const calls = enabled ? await prisma.scriptCall.findMany({
        where: { isPublic: true, status: 'open' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
            id: true, title: true, description: true, genre: true,
            toneKeywords: true, targetLength: true, deadline: true,
            status: true, maxSubmissions: true, createdAt: true,
            project: { select: { title: true, coverImage: true } },
            _count: { select: { submissions: true } },
        },
    }) : []

    type TransMap = Record<string, Record<string, string>>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function getLocalized(call: Record<string, any>, field: string, fallback: string): string {
        const translations = call.contentTranslations as string | null | undefined
        if (!translations || locale === 'en') return fallback
        try {
            const map = JSON.parse(translations) as TransMap
            return map[locale]?.[field] || fallback
        } catch { return fallback }
    }

    const comingSoon = enabled ? await prisma.scriptCall.findMany({
        where: { isPublic: true, status: { not: 'open' } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
            id: true, title: true, description: true, genre: true,
            toneKeywords: true, targetLength: true, deadline: true,
            status: true, maxSubmissions: true, createdAt: true,
            project: { select: { title: true, coverImage: true } },
        },
    }) : []

    const userId = session.userId as string
    let subscribedIds = new Set<string>()
    if (comingSoon.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subs = await (prisma as any).scriptCallNotify.findMany({
            where: { userId, scriptCallId: { in: comingSoon.map(c => c.id) } },
            select: { scriptCallId: true },
        }).catch(() => [])
        subscribedIds = new Set(subs.map((s: { scriptCallId: string }) => s.scriptCallId))
    }

    let alreadySubscribed = false
    try {
        const userEmail = (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email
        if (userEmail) {
            const sub = await prisma.subscriber.findUnique({ where: { email: userEmail }, select: { active: true } })
            alreadySubscribed = sub?.active === true
        }
    } catch { /* ignore */ }

    return (
        <>
            <ScriptVideoBackground />
            <CinematicBackground variant="creative" />

            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes shimmer {
                    0%   { background-position: -200% center; }
                    100% { background-position:  200% center; }
                }
                @keyframes penFloat {
                    0%, 100% { transform: translateY(0) rotate(-3deg); }
                    50%      { transform: translateY(-6px) rotate(3deg); }
                }
                @keyframes pulseDot {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50%      { opacity: 0.5; transform: scale(0.75); }
                }
                @keyframes glowPulse {
                    0%, 100% { box-shadow: 0 4px 20px rgba(0,0,0,0.25), 0 0 0 rgba(212,168,83,0); }
                    50%      { box-shadow: 0 4px 20px rgba(0,0,0,0.25), 0 0 20px rgba(212,168,83,0.08); }
                }

                .script-hero   { animation: fadeInUp 0.5s ease both; }
                .script-badge  { animation: fadeInUp 0.5s ease 0.1s both; }
                .script-steps  { animation: fadeInUp 0.5s ease 0.2s both; }
                .script-calls  { animation: fadeInUp 0.5s ease 0.25s both; }


                /* ── Script Card — matches form-card style ── */
                .script-card {
                    display: block;
                    text-decoration: none;
                    border-radius: 20px;
                    overflow: hidden;
                    background: rgba(255,255,255,0.08);
                    border: 1px solid rgba(212,168,83,0.18);
                    backdrop-filter: blur(40px) saturate(140%);
                    -webkit-backdrop-filter: blur(40px) saturate(140%);
                    box-shadow: 0 4px 20px rgba(0,0,0,0.25);
                    transition: all 0.35s cubic-bezier(0.16,1,0.3,1);
                    position: relative;
                    animation: glowPulse 4s ease-in-out infinite;
                }
                .script-card::before {
                    content: '';
                    position: absolute; inset: 0;
                    background: linear-gradient(135deg, rgba(212,168,83,0.06) 0%, transparent 60%);
                    opacity: 0; transition: opacity 0.35s;
                    pointer-events: none;
                }
                .script-card:hover {
                    transform: translateY(-4px);
                    border-color: rgba(212,168,83,0.35);
                    box-shadow: 0 20px 56px rgba(0,0,0,0.35), 0 0 36px rgba(212,168,83,0.1);
                }
                .script-card:hover::before { opacity: 1; }
                .script-card:active { transform: scale(0.98); }

                .submit-btn {
                    display: inline-flex; align-items: center; gap: 5px;
                    font-size: 0.72rem; font-weight: 700;
                    color: #0f1115; letter-spacing: 0.04em;
                    background: linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold));
                    padding: 7px 18px;
                    border-radius: 99px;
                    border: none;
                    box-shadow: 0 2px 10px rgba(212,168,83,0.25);
                    transition: all 0.3s ease;
                    white-space: nowrap;
                }
                .script-card:hover .submit-btn {
                    gap: 8px;
                    box-shadow: 0 4px 18px rgba(212,168,83,0.4);
                    filter: brightness(1.06);
                }

                /* ── Responsive ── */
                @media (max-width: 640px) {
                    .scripts-grid { grid-template-columns: 1fr !important; }
                    .coming-grid  { grid-template-columns: 1fr !important; }
                }
                @media (min-width: 641px) and (max-width: 900px) {
                    .scripts-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>

            <main style={{ minHeight: '100vh', paddingTop: '72px', position: 'relative', zIndex: 2 }}>

                {/* ══ HERO ══ */}
                <section style={{ textAlign: 'center', padding: '40px 20px 28px' }}>
                    <div style={{ maxWidth: '640px', margin: '0 auto' }}>
                        <div style={{
                            display: 'inline-block', fontSize: '2.4rem',
                            marginBottom: '12px',
                            animation: 'penFloat 3s ease-in-out infinite',
                        }}>✍️</div>

                        <div className="script-badge" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '7px',
                            fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em',
                            textTransform: 'uppercase', color: 'var(--accent-gold)',
                            background: 'rgba(212,168,83,0.08)',
                            padding: '5px 14px', borderRadius: '99px',
                            border: '1px solid rgba(212,168,83,0.2)',
                            marginBottom: '14px',
                        }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-gold)', animation: 'pulseDot 2s ease-in-out infinite' }} />
                            {t('badge')}
                        </div>

                        <h1 className="script-hero" style={{
                            fontSize: 'clamp(1.9rem, 7vw, 3.4rem)',
                            fontWeight: 800, lineHeight: 1.08,
                            marginBottom: '0',
                            letterSpacing: '-0.02em',
                        }}>
                            {t('heroTitle')}{' '}
                            <span style={{
                                fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                                background: 'linear-gradient(135deg, #d4a853, #f0c96e, #c49b3a)',
                                backgroundSize: '200% auto',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                animation: 'shimmer 4s linear infinite',
                            }}>
                                {t('heroAccent')}
                            </span>
                        </h1>
                    </div>
                </section>

                {/* ══ HOW IT WORKS — compact frosted step strip ══ */}
                <section style={{ padding: '0 16px 28px', textAlign: 'center' }} className="script-steps">
                    <div style={{
                        display: 'inline-flex', alignItems: 'center',
                        flexWrap: 'wrap', justifyContent: 'center',
                        gap: '4px',
                        padding: '12px 22px',
                        background: 'rgba(255,255,255,0.12)',
                        backdropFilter: 'blur(20px) saturate(160%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
                        border: '1px solid rgba(255,255,255,0.25)',
                        borderRadius: '99px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.4)',
                    }} className="step-strip">
                        {([
                            { icon: '📝', step: '01', titleKey: 'step1Title' },
                            { icon: '🤖', step: '02', titleKey: 'step2Title' },
                            { icon: '🎬', step: '03', titleKey: 'step3Title' },
                        ] as const).map(({ icon, step, titleKey }, i) => (
                            <>
                                <span key={step} style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '2px 4px',
                                }}>
                                    <span style={{
                                        width: '18px', height: '18px', borderRadius: '50%',
                                        background: 'rgba(212,168,83,0.18)',
                                        border: '1px solid rgba(212,168,83,0.35)',
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.5rem', fontWeight: 800, color: 'var(--accent-gold)',
                                        flexShrink: 0,
                                    }}>{step}</span>
                                    <span style={{ fontSize: '0.7rem' }}>{icon}</span>
                                    <span style={{
                                        fontSize: '0.72rem', fontWeight: 700,
                                        color: 'rgba(15,15,20,0.9)',
                                        whiteSpace: 'nowrap',
                                    }}>{t(titleKey)}</span>
                                </span>
                                {i < 2 && (
                                    <span className="step-arrow" style={{
                                        fontSize: '0.7rem', color: 'rgba(0,0,0,0.3)',
                                        margin: '0 2px',
                                    }}>→</span>
                                )}
                            </>
                        ))}
                    </div>
                </section>

                {/* ══ CALLS ══ */}
                <section style={{ padding: '0 16px 80px' }} className="script-calls">
                    <div style={{ maxWidth: '960px', margin: '0 auto' }}>

                        {!enabled ? (
                            <div style={{
                                textAlign: 'center', padding: '48px 24px',
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: '18px', border: '1px solid var(--border-subtle)',
                            }}>
                                <div style={{ fontSize: '3rem', marginBottom: '14px' }}>📜</div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px' }}>{t('closedTitle')}</h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', maxWidth: '400px', margin: '0 auto 20px', fontSize: '0.88rem', lineHeight: 1.6 }}>
                                    {t('closedDesc')}
                                </p>
                                <NotifyNewCallsButton initialSubscribed={alreadySubscribed} />
                            </div>

                        ) : calls.length === 0 ? (
                            <div style={{
                                textAlign: 'center', padding: '48px 24px',
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: '18px', border: '1px solid var(--border-subtle)',
                            }}>
                                <div style={{ fontSize: '3rem', marginBottom: '14px' }}>🔍</div>
                                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '10px' }}>{t('noCallsTitle')}</h2>
                                <p style={{ color: 'var(--text-secondary)', maxWidth: '380px', margin: '0 auto 20px', fontSize: '0.88rem', lineHeight: 1.6 }}>
                                    {t('noCallsDesc')}
                                </p>
                                <NotifyNewCallsButton initialSubscribed={alreadySubscribed} />
                            </div>

                        ) : (
                            <>
                                {/* Section header */}
                                <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '2px' }}>
                                            {t('openCallsTitle')}
                                        </h2>
                                        <p style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                            {calls.length} {calls.length === 1 ? t('callSingular') : t('callPlural')}
                                        </p>
                                    </div>
                                </div>

                                {/* Cards grid */}
                                <div className="scripts-grid" style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                    gap: '14px',
                                }}>
                                    {calls.map((call, i) => (
                                        <Link
                                            key={call.id}
                                            href={`/scripts/${call.id}`}
                                            className="script-card"
                                            style={{ animationDelay: `${i * 70}ms`, animation: 'fadeInUp 0.45s ease both' }}
                                        >
                                            {/* Card header tint */}
                                            <div style={{
                                                padding: '18px 18px 14px',
                                                background: 'linear-gradient(135deg, rgba(255,255,255,0.08), transparent)',
                                                borderBottom: '1px solid rgba(255,255,255,0.15)',
                                            }}>
                                                {/* Project badge */}
                                                {call.project && (
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', gap: '7px',
                                                        marginBottom: '10px',
                                                    }}>
                                                        {call.project.coverImage && (
                                                            <div style={{
                                                                width: '22px', height: '22px', borderRadius: '5px',
                                                                backgroundImage: `url(${call.project.coverImage})`,
                                                                backgroundSize: 'cover', backgroundPosition: 'center',
                                                                border: '1px solid rgba(212,168,83,0.25)', flexShrink: 0,
                                                            }} />
                                                        )}
                                                        <span style={{
                                                            fontSize: '0.58rem', color: 'var(--accent-gold)',
                                                            textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700,
                                                            fontFamily: 'var(--font-display)',
                                                            textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                                                        }}>
                                                            {t('forProject')}: {call.project.title}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Title */}
                                                <h3 style={{
                                                    fontSize: '1.05rem', fontWeight: 800,
                                                    fontFamily: 'var(--font-display)',
                                                    color: '#ffffff', lineHeight: 1.25,
                                                    margin: 0, letterSpacing: '-0.01em',
                                                    textShadow: '0 2px 8px rgba(0,0,0,0.5)',
                                                }}>
                                                    {getLocalized(call, 'title', call.title)}
                                                </h3>
                                            </div>

                                            {/* Card body */}
                                            <div style={{ padding: '14px 18px' }}>
                                                {/* Description */}
                                                <p style={{
                                                    fontSize: '0.8rem', color: 'rgba(255,255,255,0.85)',
                                                    marginBottom: '12px', lineHeight: 1.6,
                                                    textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 3,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                }}>
                                                    {getLocalized(call, 'description', call.description)}
                                                </p>

                                                {/* Tags */}
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '14px' }}>
                                                    {call.genre && (
                                                        <span style={{
                                                            fontSize: '0.6rem', padding: '2px 9px', fontWeight: 600,
                                                            background: 'rgba(212,168,83,0.08)', color: 'var(--accent-gold)',
                                                            borderRadius: '5px', border: '1px solid rgba(212,168,83,0.18)',
                                                        }}>{getLocalized(call, 'genre', call.genre)}</span>
                                                    )}
                                                    {call.targetLength && (
                                                        <span style={{
                                                            fontSize: '0.6rem', padding: '2px 9px', fontWeight: 600,
                                                            background: 'rgba(96,165,250,0.07)', color: '#60a5fa',
                                                            borderRadius: '5px', border: '1px solid rgba(96,165,250,0.14)',
                                                        }}>{call.targetLength}</span>
                                                    )}
                                                    {call.deadline && (
                                                        <span style={{
                                                            fontSize: '0.6rem', padding: '2px 9px',
                                                            background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)',
                                                            borderRadius: '5px', border: '1px solid rgba(255,255,255,0.2)',
                                                        }}>⏰ {call.deadline}</span>
                                                    )}
                                                </div>

                                                {/* Footer */}
                                                <div style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.15)',
                                                }}>
                                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                                                        {call._count.submissions === 0
                                                            ? t('beFirstToSubmit')
                                                            : `${call._count.submissions} ${call._count.submissions !== 1 ? t('submissions') : t('submission')}`
                                                        }
                                                    </span>
                                                    <span className="submit-btn">
                                                        {t('submitScript')} <span>→</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* ── COMING SOON ── */}
                        {comingSoon.length > 0 && (
                            <div style={{ marginTop: '48px' }}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    marginBottom: '16px',
                                }}>
                                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(212,168,83,0.2))' }} />
                                    <span style={{
                                        fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.14em',
                                        textTransform: 'uppercase', color: 'var(--accent-gold)', opacity: 0.7,
                                        whiteSpace: 'nowrap',
                                    }}>⏳ {t('comingSoonLabel')}</span>
                                    <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, rgba(212,168,83,0.2))' }} />
                                </div>

                                <div className="coming-grid" style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                    gap: '12px',
                                }}>
                                    {comingSoon.map((call, i) => (
                                        <div
                                            key={call.id}
                                            style={{
                                                position: 'relative',
                                                padding: '16px 18px',
                                                borderRadius: '14px',
                                                background: 'rgba(255,255,255,0.015)',
                                                border: '1px solid rgba(255,255,255,0.06)',
                                                backdropFilter: 'blur(16px)',
                                                animationDelay: `${i * 70}ms`,
                                                animation: 'fadeInUp 0.45s ease both',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div style={{
                                                position: 'absolute', top: '10px', right: '12px',
                                                fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.1em',
                                                textTransform: 'uppercase',
                                                color: 'rgba(212,168,83,0.6)',
                                                background: 'rgba(212,168,83,0.06)',
                                                border: '1px solid rgba(212,168,83,0.12)',
                                                padding: '2px 8px', borderRadius: '99px',
                                            }}>
                                                {t('comingSoonBadge')}
                                            </div>

                                            {call.project && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                                                    {call.project.coverImage && (
                                                        <div style={{
                                                            width: '20px', height: '20px', borderRadius: '4px',
                                                            backgroundImage: `url(${call.project.coverImage})`,
                                                            backgroundSize: 'cover', backgroundPosition: 'center',
                                                            border: '1px solid rgba(212,168,83,0.12)',
                                                            flexShrink: 0, opacity: 0.6,
                                                        }} />
                                                    )}
                                                    <span style={{
                                                        fontSize: '0.58rem', color: 'rgba(212,168,83,0.6)',
                                                        textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700,
                                                    }}>
                                                        {t('forProject')}: {call.project.title}
                                                    </span>
                                                </div>
                                            )}

                                            <h3 style={{
                                                fontSize: '0.95rem', fontWeight: 700,
                                                color: 'var(--text-primary)', lineHeight: 1.3, opacity: 0.8,
                                                marginBottom: '6px',
                                            }}>
                                                {getLocalized(call, 'title', call.title)}
                                            </h3>

                                            <p style={{
                                                fontSize: '0.75rem', color: 'var(--text-tertiary)',
                                                marginBottom: '12px', lineHeight: 1.55,
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                            }}>
                                                {getLocalized(call, 'description', call.description)}
                                            </p>

                                            {call.genre && (
                                                <span style={{
                                                    display: 'inline-block',
                                                    fontSize: '0.58rem', padding: '2px 8px', fontWeight: 600,
                                                    background: 'rgba(212,168,83,0.05)', color: 'rgba(212,168,83,0.55)',
                                                    borderRadius: '5px', border: '1px solid rgba(212,168,83,0.1)',
                                                    marginBottom: '12px',
                                                }}>{getLocalized(call, 'genre', call.genre)}</span>
                                            )}

                                            <NotifyMeButton
                                                scriptCallId={call.id}
                                                initialSubscribed={subscribedIds.has(call.id)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
