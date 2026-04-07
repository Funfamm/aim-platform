import Link from 'next/link'
import Footer from '@/components/Footer'
import CinematicBackground from '@/components/CinematicBackground'
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
        include: {
            project: { select: { title: true, coverImage: true } },
            _count: { select: { submissions: true } },
        },
    }) : []

    return (
        <>
            <CinematicBackground variant="creative" />

            <style>{`
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(24px); }
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
                .script-hero    { animation: fadeInUp 0.6s ease both; }
                .script-badge   { animation: fadeInUp 0.6s ease 0.1s both; }
                .script-desc    { animation: fadeInUp 0.6s ease 0.2s both; }
                .script-notice  { animation: fadeInUp 0.6s ease 0.3s both; }
                .script-process { animation: fadeInUp 0.6s ease 0.35s both; }
                .script-card {
                    position: relative;
                    display: block;
                    padding: var(--space-xl);
                    text-decoration: none;
                    border-radius: var(--radius-xl);
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.07);
                    backdrop-filter: blur(20px);
                    transition: all 0.35s cubic-bezier(0.16,1,0.3,1);
                    overflow: hidden;
                }
                .script-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(135deg, rgba(212,168,83,0.06), transparent 60%);
                    opacity: 0;
                    transition: opacity 0.35s ease;
                }
                .script-card:hover {
                    transform: translateY(-4px);
                    border-color: rgba(212,168,83,0.3);
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(212,168,83,0.1);
                }
                .script-card:hover::before { opacity: 1; }
                .script-card:hover .submit-btn {
                    background: var(--accent-gold) !important;
                    color: #0f1115 !important;
                }
                .submit-btn { transition: all 0.25s ease !important; }
                .step-line {
                    position: absolute;
                    left: 19px;
                    top: 40px;
                    bottom: -12px;
                    width: 2px;
                    background: linear-gradient(to bottom, rgba(212,168,83,0.3), transparent);
                }
                @media (max-width: 600px) {
                    .scripts-grid { grid-template-columns: 1fr !important; }
                    .process-steps { flex-direction: column !important; gap: 16px !important; }
                    .process-step-line { display: none !important; }
                }
            `}</style>

            <main style={{ minHeight: '100vh', paddingTop: '90px', position: 'relative', zIndex: 2 }}>

                {/* ══ HERO ══ */}
                <section style={{ textAlign: 'center', padding: 'var(--space-3xl) 0 var(--space-2xl)' }}>
                    <div className="container" style={{ maxWidth: '720px' }}>
                        {/* Floating pen icon */}
                        <div style={{
                            display: 'inline-block',
                            fontSize: '3rem', marginBottom: 'var(--space-md)',
                            animation: 'penFloat 3s ease-in-out infinite',
                        }}>✍️</div>

                        <div className="script-badge" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: 'var(--accent-gold)',
                            background: 'rgba(212,168,83,0.08)',
                            padding: '5px 16px',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid rgba(212,168,83,0.2)',
                            marginBottom: 'var(--space-md)',
                        }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-gold)', animation: 'heartFloat 2s ease-in-out infinite' }} />
                            {t('badge')}
                        </div>

                        <h1 className="script-hero" style={{
                            fontSize: 'clamp(2.2rem, 6vw, 3.8rem)',
                            fontWeight: 800, lineHeight: 1.05,
                            marginBottom: 'var(--space-md)',
                        }}>
                            {t('heroTitle')}{' '}
                            <span style={{
                                fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                                color: 'var(--accent-gold)',
                                background: 'linear-gradient(135deg, #d4a853, #f0c96e, #c49b3a)',
                                backgroundSize: '200% auto',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                animation: 'shimmer 4s linear infinite',
                            }}>
                                {t('heroAccent')}
                            </span>
                        </h1>

                        <p className="script-desc" style={{
                            maxWidth: '580px', margin: '0 auto var(--space-lg)',
                            color: 'var(--text-secondary)', fontSize: '1.08rem', lineHeight: 1.7,
                        }}>
                            {t('heroDesc')}
                        </p>

                        {/* Notice pill */}
                        <div className="script-notice" style={{
                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                            fontSize: '0.72rem', color: 'var(--text-tertiary)',
                            background: 'rgba(255,255,255,0.03)',
                            padding: '7px 18px',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--border-subtle)',
                        }}>
                            <span>🏆</span>
                            {t('noCompensation')}
                        </div>
                    </div>
                </section>

                {/* ══ HOW IT WORKS ══ */}
                <section style={{ padding: 'var(--space-xl) 0' }}>
                    <div className="container" style={{ maxWidth: '800px' }}>
                        <div className="script-process" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 'var(--space-lg)',
                            marginBottom: 'var(--space-3xl)',
                        }}>
                            {([
                                { icon: '📝', step: '01', titleKey: 'step1Title', descKey: 'step1Desc' },
                                { icon: '🤖', step: '02', titleKey: 'step2Title', descKey: 'step2Desc' },
                                { icon: '🎬', step: '03', titleKey: 'step3Title', descKey: 'step3Desc' },
                            ] as const).map(({ icon, step, titleKey, descKey }) => (
                                <div key={step} style={{
                                    textAlign: 'center',
                                    padding: 'var(--space-lg) var(--space-md)',
                                    background: 'rgba(255,255,255,0.02)',
                                    borderRadius: 'var(--radius-xl)',
                                    border: '1px solid var(--border-subtle)',
                                }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{icon}</div>
                                    <div style={{
                                        fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.12em',
                                        color: 'var(--accent-gold)', textTransform: 'uppercase', marginBottom: '6px',
                                    }}>{t('stepLabel')} {step}</div>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '4px' }}>{t(titleKey)}</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>{t(descKey)}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ══ CALLS LIST / EMPTY / CLOSED ══ */}
                <section style={{ padding: '0 0 var(--space-4xl)' }}>
                    <div className="container" style={{ maxWidth: '1000px' }}>

                        {!enabled ? (
                            /* -- Script calls disabled -- */
                            <div style={{
                                textAlign: 'center',
                                padding: 'var(--space-3xl)',
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: 'var(--radius-xl)',
                                border: '1px solid var(--border-subtle)',
                            }}>
                                <div style={{ fontSize: '3.5rem', marginBottom: 'var(--space-md)' }}>📜</div>
                                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
                                    {t('closedTitle')}
                                </h2>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', maxWidth: '480px', margin: '0 auto var(--space-lg)' }}>
                                    {t('closedDesc')}
                                </p>
                                <Link href="/subscribe" className="btn btn-primary" style={{ display: 'inline-block' }}>
                                    {t('notifyCta')}
                                </Link>
                            </div>

                        ) : calls.length === 0 ? (
                            /* -- Enabled but no open calls -- */
                            <div style={{
                                textAlign: 'center',
                                padding: 'var(--space-3xl)',
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: 'var(--radius-xl)',
                                border: '1px solid var(--border-subtle)',
                            }}>
                                <div style={{ fontSize: '3.5rem', marginBottom: 'var(--space-md)' }}>🔍</div>
                                <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: 'var(--space-sm)' }}>
                                    {t('noCallsTitle')}
                                </h2>
                                <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', margin: '0 auto var(--space-lg)' }}>
                                    {t('noCallsDesc')}
                                </p>
                                <Link href="/subscribe" className="btn btn-primary" style={{ display: 'inline-block' }}>
                                    {t('notifyCta')}
                                </Link>
                            </div>

                        ) : (
                            /* -- Active calls grid -- */
                            <>
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    marginBottom: 'var(--space-xl)',
                                }}>
                                    <div>
                                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '4px' }}>
                                            {t('openCallsTitle')}
                                        </h2>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                                            {calls.length} {calls.length === 1 ? t('callSingular') : t('callPlural')}
                                        </p>
                                    </div>
                                </div>

                                <div className="scripts-grid" style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                                    gap: 'var(--space-lg)',
                                    alignItems: 'start',
                                }}>
                                    {calls.map((call, i) => (
                                        <Link
                                            key={call.id}
                                            href={`/scripts/${call.id}`}
                                            className="script-card"
                                            style={{ animationDelay: `${i * 80}ms`, animation: 'fadeInUp 0.5s ease both' }}
                                        >
                                            {/* Project badge */}
                                            {call.project && (
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    marginBottom: 'var(--space-md)',
                                                }}>
                                                    {call.project.coverImage && (
                                                        <div style={{
                                                            width: '28px', height: '28px', borderRadius: '6px',
                                                            backgroundImage: `url(${call.project.coverImage})`,
                                                            backgroundSize: 'cover', backgroundPosition: 'center',
                                                            border: '1px solid rgba(212,168,83,0.2)',
                                                            flexShrink: 0,
                                                        }} />
                                                    )}
                                                    <span style={{
                                                        fontSize: '0.65rem', color: 'var(--accent-gold)',
                                                        textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
                                                    }}>
                                                        {t('forProject')}: {call.project.title}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Title */}
                                            <h3 style={{
                                                fontSize: '1.15rem', fontWeight: 700,
                                                marginBottom: 'var(--space-sm)',
                                                color: 'var(--text-primary)',
                                                lineHeight: 1.3,
                                            }}>
                                                {call.title}
                                            </h3>

                                            {/* Description */}
                                            <p style={{
                                                fontSize: '0.85rem', color: 'var(--text-secondary)',
                                                marginBottom: 'var(--space-lg)', lineHeight: 1.65,
                                            }}>
                                                {call.description.slice(0, 180)}{call.description.length > 180 ? '…' : ''}
                                            </p>

                                            {/* Tags */}
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: 'var(--space-lg)' }}>
                                                {call.genre && (
                                                    <span style={{
                                                        fontSize: '0.63rem', padding: '3px 10px', fontWeight: 600,
                                                        background: 'rgba(212,168,83,0.08)', color: 'var(--accent-gold)',
                                                        borderRadius: 'var(--radius-full)', border: '1px solid rgba(212,168,83,0.18)',
                                                    }}>{call.genre}</span>
                                                )}
                                                {call.targetLength && (
                                                    <span style={{
                                                        fontSize: '0.63rem', padding: '3px 10px', fontWeight: 600,
                                                        background: 'rgba(96,165,250,0.08)', color: '#60a5fa',
                                                        borderRadius: 'var(--radius-full)', border: '1px solid rgba(96,165,250,0.15)',
                                                    }}>{call.targetLength}</span>
                                                )}
                                                {call.deadline && (
                                                    <span style={{
                                                        fontSize: '0.63rem', padding: '3px 10px',
                                                        background: 'rgba(255,255,255,0.03)', color: 'var(--text-tertiary)',
                                                        borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)',
                                                    }}>
                                                        ⏰ {t('deadlineLabel')}: {call.deadline}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Footer */}
                                            <div style={{
                                                display: 'flex', justifyContent: 'space-between',
                                                alignItems: 'center',
                                                paddingTop: 'var(--space-md)',
                                                borderTop: '1px solid var(--border-subtle)',
                                            }}>
                                                <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                                                    {call._count.submissions} {call._count.submissions !== 1 ? t('submissions') : t('submission')}
                                                </span>
                                                <span className="btn btn-primary btn-sm submit-btn">
                                                    {t('submitScript')} →
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
