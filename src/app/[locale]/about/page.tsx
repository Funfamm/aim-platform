import { Metadata } from 'next'
import Footer from '@/components/Footer'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import AboutBackground from '@/components/AboutBackground'
import AnimatedCounter from '@/components/AnimatedCounter'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'About | AIM Studio',
    description: 'Learn about AIM Studio, where artificial intelligence meets cinematic storytelling.',
}

const DEFAULT_MISSION = `AIM Studio exists to showcase what happens when artificial intelligence meets cinematic storytelling and to build it all with the community. Every production we release, every tool we build, every opportunity we create is designed to be shared.`

const DEFAULT_STORY = `We're not a traditional studio behind closed doors. We create AI-powered films, shorts, and visual experiences and we do it in the open. Our casting calls reach creators in 30+ countries. Our training hub teaches real skills. Our platform is where the community watches, learns, and joins the process.

This is cinema built together. Your talent, your creativity, powered by AI. Welcome to AIM Studio.`

async function fetchAboutStats() {
    const [productions, countryRows, memberCount] = await Promise.all([
        prisma.project.count({ where: { OR: [{ projectType: 'movie' }, { projectType: 'series' }] } }),
        prisma.project.findMany({ where: { country: { not: null } }, select: { country: true } }),
        prisma.user.count({ where: { emailVerified: true, role: 'member' } }),
    ]);
    const distinctCountries = new Set(countryRows.map(r => r.country)).size;
    const awards = 0; // placeholder until an Award model exists
    return { productions, distinctCountries, distinctCreators: memberCount, awards };
}

export default async function AboutPage() {
    let settings = null
    try { settings = await prisma.siteSettings.findFirst() as any } catch { /* schema drift */ }
    const session = await getUserSession()
    const isLoggedIn = !!session?.userId
    const stats = await fetchAboutStats()

    const pageMedia = await prisma.pageMedia.findMany({
        where: { page: 'about', type: 'background', active: true },
        orderBy: { sortOrder: 'asc' },
    })
    const bgUrls = pageMedia.map(m => m.url)

    const t = await getTranslations('about')
    const tHome = await getTranslations('home')
    const mission = settings?.mission || t('missionText' as any) || DEFAULT_MISSION
    const studioStory = settings?.studioStory || t('storyText' as any) || DEFAULT_STORY
    const storyParagraphs = studioStory.split('\n').filter((p: string) => p.trim())

    // Parse admin overrides — fall back to translations when empty
    let apd: Record<string, string | number> = {}
    try { if ((settings as any)?.aboutPageData) apd = JSON.parse((settings as any).aboutPageData) } catch { /* */ }
    const v = (dbKey: string, translationKey: string) => {
        const dbVal = apd[dbKey]
        if (dbVal !== undefined && dbVal !== '' && dbVal !== 0) return String(dbVal)
        return t(translationKey)
    }
    const n = (dbKey: string, fallback: number) => {
        const dbVal = apd[dbKey]
        if (typeof dbVal === 'number' && dbVal > 0) return dbVal
        return fallback
    }

    const glassCard = {
        background: 'rgba(22,24,35,0.55)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 'var(--radius-xl)',
    }

    return (
        <>
            <AboutBackground bgUrls={bgUrls} />
            <main id="main-content" tabIndex={0} role="main" aria-label="About page content" style={{ position: 'relative', zIndex: 2 }}>

                {/* ═══════════════════ HERO ═══════════════════ */}
                <section style={{
                    padding: 'calc(var(--space-5xl) + 80px) 0 var(--space-xl)',
                    textAlign: 'center',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}>
                    {/* Floating orbs */}
                    <div style={{
                        position: 'absolute', top: '15%', left: '10%',
                        width: '300px', height: '300px', borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)',
                        filter: 'blur(60px)', pointerEvents: 'none',
                        animation: 'float 8s ease-in-out infinite',
                    }} />
                    <div style={{
                        position: 'absolute', bottom: '20%', right: '8%',
                        width: '250px', height: '250px', borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(100,130,230,0.05) 0%, transparent 70%)',
                        filter: 'blur(60px)', pointerEvents: 'none',
                        animation: 'float 10s ease-in-out infinite reverse',
                    }} />

                    <div className="container" style={{ maxWidth: '850px', position: 'relative' }}>
                        <ScrollReveal3D direction="up" distance={50}>
                            <span className="text-label" style={{
                                marginBottom: 'var(--space-lg)', display: 'inline-block',
                                fontFamily: '"Playfair Display", Georgia, serif',
                                fontStyle: 'italic',
                                fontSize: '0.85rem',
                                letterSpacing: '0.15em',
                                color: 'rgba(212,168,83,0.7)',
                            }}>
                                {t('label')}
                            </span>
                            <h1 style={{
                                fontSize: 'clamp(2.2rem, 5.5vw, 3.8rem)',
                                fontWeight: 800,
                                lineHeight: 1.1,
                                marginBottom: 'var(--space-lg)',
                                letterSpacing: '-0.03em',
                                fontFamily: 'Outfit, sans-serif',
                            }}>
                                {t('title')}<br />
                                <span style={{
                                    fontFamily: '"Playfair Display", Georgia, serif',
                                    fontWeight: 700,
                                    fontStyle: 'italic',
                                    letterSpacing: '0.01em',
                                    background: 'linear-gradient(135deg, var(--accent-gold) 0%, #f5d799 30%, #FFE4A0 50%, var(--accent-gold) 100%)',
                                    backgroundSize: '200% auto',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    animation: 'shimmerText 4s linear infinite',
                                }}>
                                    {t('titleAccent')}
                                </span>
                            </h1>
                        </ScrollReveal3D>

                        {/* Scroll indicator */}
                        <div style={{
                            position: 'absolute', bottom: '-60px', left: '50%', transform: 'translateX(-50%)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                            opacity: 0.5,
                        }}>
                            <div style={{
                                width: '1px', height: '40px',
                                background: 'linear-gradient(to bottom, var(--accent-gold), transparent)',
                            }} />
                        </div>
                    </div>
                </section>

                {/* ═══════════════════ STATS BAR ═══════════════════ */}
                <section style={{ padding: 'var(--space-lg) 0 var(--space-3xl)', position: 'relative' }}>
                    <div className="container" style={{ maxWidth: '900px' }}>
                        <ScrollReveal3D direction="up" distance={30}>
                            <div className="about-stats-grid" tabIndex={0} role="region" aria-label="Key statistics" style={{
                                ...glassCard,
                                padding: 'var(--space-2xl) var(--space-xl)',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: 'var(--space-lg)',
                                position: 'relative',
                                overflow: 'hidden',
                            }}>
                                {/* Accent line */}
                                <div style={{
                                    position: 'absolute', top: 0, left: '10%', right: '10%', height: '1px',
                                    background: 'linear-gradient(to right, transparent, var(--accent-gold), transparent)',
                                }} />
                                <AnimatedCounter end={stats.productions} suffix="+" label={v('stat1Label', 'statsProductions')} />
                                <AnimatedCounter end={stats.distinctCountries} suffix="+" label={v('stat2Label', 'statsCountries')} />
                                <AnimatedCounter end={stats.distinctCreators} suffix="+" label={v('stat3Label', 'statsCreators')} />
                                <AnimatedCounter end={stats.awards} label={v('stat4Label', 'statsAwards')} />
                            </div>
                        </ScrollReveal3D>
                    </div>
                </section>

                {/* ═══════════════════ OUR VISION ═══════════════════ */}
                <section style={{ padding: 'var(--space-3xl) 0', position: 'relative' }}>
                    <div className="container" style={{ maxWidth: '1000px' }}>
                        <ScrollReveal3D direction="up" delay={100} distance={30}>
                            <div style={{
                                ...glassCard,
                                textAlign: 'center', marginBottom: 'var(--space-3xl)',
                                padding: 'var(--space-xl)',
                            }}>
                                <span className="text-label">{tHome('ourVision')}</span>
                                <h2 style={{
                                    marginTop: 'var(--space-sm)',
                                    marginBottom: 'var(--space-md)',
                                    fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)',
                                    fontWeight: 800,
                                    lineHeight: 1.15,
                                }}>
                                    {tHome('redefining')}{' '}
                                    <span style={{
                                        fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic',
                                        background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                                    }}>{tHome('redefiningAccent')}</span>
                                </h2>
                                <div className="divider divider-center" />
                                <p style={{
                                    fontSize: 'clamp(0.88rem, 2vw, 1rem)',
                                    color: 'var(--text-secondary)',
                                    maxWidth: '600px',
                                    margin: '0 auto',
                                    lineHeight: 1.75,
                                    marginTop: 'var(--space-md)',
                                }}>
                                    {tHome('visionP1')}
                                </p>
                            </div>
                        </ScrollReveal3D>

                        {/* Feature cards grid */}
                        <div className="grid-3col" tabIndex={0} role="region" aria-label="Feature highlights" style={{
                            gap: 'var(--space-lg)',
                        }}>
                            {[
                                {
                                    icon: '🎯',
                                    value: tHome('zeroCompromise'),
                                    desc: tHome('visionP2'),
                                    cardClass: 'feature-card-gold',
                                    border: 'rgba(212,168,83,0.25)',
                                },
                                {
                                    icon: '✨',
                                    value: tHome('limitless'),
                                    desc: tHome('limitlessDesc'),
                                    cardClass: 'feature-card-purple',
                                    border: 'rgba(139,92,246,0.25)',
                                },
                                {
                                    icon: '🎬',
                                    value: tHome('cinematic'),
                                    desc: tHome('cinematicDesc'),
                                    cardClass: 'feature-card-blue',
                                    border: 'rgba(59,130,246,0.25)',
                                },
                            ].map((card, i) => (
                                <ScrollReveal3D key={i} direction="up" delay={200 + i * 150} distance={30} rotate={3}>
                                    <div className={card.cardClass} style={{
                                        padding: 'var(--space-xl)',
                                        borderRadius: 'var(--radius-xl)',
                                        border: `1px solid ${card.border}`,
                                        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
                                        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                                        height: '100%',
                                    }}>
                                        <div style={{ fontSize: '2.2rem', marginBottom: 'var(--space-md)' }}>{card.icon}</div>
                                        <h3 style={{
                                            fontSize: '1.05rem',
                                            fontWeight: 700,
                                            marginBottom: 'var(--space-sm)',
                                            fontFamily: 'Outfit, sans-serif',
                                        }}>{card.value}</h3>
                                        <p style={{
                                            fontSize: '0.85rem',
                                            color: 'var(--text-secondary)',
                                            lineHeight: 1.7,
                                            margin: 0,
                                        }}>{card.desc}</p>
                                    </div>
                                </ScrollReveal3D>
                            ))}
                        </div>

                        {/* Stats row */}
                        <ScrollReveal3D direction="up" delay={600} distance={20}>
                            <div tabIndex={0} role="region" aria-label="Production pillars" style={{
                                ...glassCard,
                                display: 'flex',
                                justifyContent: 'center',
                                gap: 'var(--space-3xl)',
                                marginTop: 'var(--space-3xl)',
                                padding: 'var(--space-xl)',
                            }}>
                                {[
                                    { value: '100%', label: tHome('zeroCompromise') },
                                    { value: '∞', label: tHome('limitless') },
                                    { value: '24fps', label: tHome('cinematic') },
                                ].map((stat, i) => (
                                    <div key={i} style={{ textAlign: 'center' }}>
                                        <div style={{
                                            fontFamily: 'Outfit, sans-serif',
                                            fontSize: '2.2rem',
                                            fontWeight: 800,
                                            background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            backgroundClip: 'text',
                                            letterSpacing: '-0.02em',
                                        }}>
                                            {stat.value}
                                        </div>
                                        <div style={{
                                            fontSize: '0.72rem', color: 'var(--text-tertiary)',
                                            letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                                            marginTop: '4px',
                                        }}>{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                        </ScrollReveal3D>
                    </div>
                </section>

                {/* ═══════════════════ MISSION + STORY ═══════════════════ */}
                <section style={{
                    padding: 'var(--space-4xl) 0',
                    position: 'relative',
                    background: 'linear-gradient(180deg, transparent, rgba(22,24,35,0.3) 20%, rgba(22,24,35,0.3) 80%, transparent)',
                }}>
                    <div className="container" style={{ maxWidth: '900px' }}>
                        <div className="about-mission-grid" tabIndex={0} role="region" aria-label="Mission and story" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-xl)', alignItems: 'start' }}>
                            {/* Mission */}
                            <ScrollReveal3D direction="left" distance={40}>
                                <div style={{
                                    ...glassCard,
                                    padding: 'var(--space-2xl)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}>
                                    <div style={{
                                        position: 'absolute', top: 0, left: 0, width: '3px', height: '100%',
                                        background: 'linear-gradient(to bottom, var(--accent-gold), transparent)',
                                    }} />
                                    <span className="text-label" style={{ marginBottom: 'var(--space-md)', display: 'inline-block' }}>
                                        {t('missionTitle')}
                                    </span>
                                    <p style={{
                                        fontSize: '0.92rem', lineHeight: 1.8, color: 'var(--text-secondary)',
                                    }}>
                                        {mission}
                                    </p>
                                </div>
                            </ScrollReveal3D>

                            {/* Story */}
                            <ScrollReveal3D direction="right" distance={40} delay={150}>
                                <div style={{
                                    ...glassCard,
                                    padding: 'var(--space-2xl)',
                                }}>
                                    {storyParagraphs.map((paragraph: string, i: number) => (
                                        <p key={i} style={{
                                            fontSize: '0.92rem', lineHeight: 1.8, color: 'var(--text-secondary)',
                                            marginBottom: i < storyParagraphs.length - 1 ? 'var(--space-lg)' : 0,
                                        }}>
                                            {paragraph}
                                        </p>
                                    ))}
                                </div>
                            </ScrollReveal3D>
                        </div>
                    </div>
                </section>

                {/* ═══════════════════ PHILOSOPHY QUOTE ═══════════════════ */}
                <section style={{ padding: 'var(--space-5xl) 0', position: 'relative' }}>
                    {/* Cinematic gradient backdrop */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(180deg, transparent 0%, rgba(212,168,83,0.03) 50%, transparent 100%)',
                        pointerEvents: 'none',
                    }} />
                    <div className="container" style={{ maxWidth: '800px', textAlign: 'center', position: 'relative' }}>
                        <ScrollReveal3D direction="up" distance={40}>
                            <span className="text-label" style={{ marginBottom: 'var(--space-xl)', display: 'inline-block' }}>
                                {t('philosophyLabel')}
                            </span>
                            <div style={{ position: 'relative', padding: '0 var(--space-xl)' }}>
                                {/* Decorative quote marks */}
                                <div style={{
                                    position: 'absolute', top: '-20px', left: '0',
                                    fontSize: '6rem', lineHeight: 1, color: 'rgba(212,168,83,0.12)',
                                    fontFamily: 'Georgia, serif', fontWeight: 700,
                                }}>"</div>
                                <blockquote style={{
                                    fontSize: 'clamp(1rem, 2.5vw, 1.4rem)',
                                    fontWeight: 600,
                                    lineHeight: 1.6,
                                    color: 'var(--text-primary)',
                                    fontStyle: 'italic',
                                    margin: 0,
                                    position: 'relative',
                                    zIndex: 1,
                                }}>
                                    {v('philosophyQuote', 'philosophyQuote')}
                                </blockquote>
                            </div>
                            <div style={{
                                marginTop: 'var(--space-xl)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-md)',
                            }}>
                                <div style={{
                                    width: '40px', height: '2px',
                                    background: 'var(--accent-gold)',
                                }} />
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{v('philosophyAuthor', 'philosophyAuthor')}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' as const, letterSpacing: '0.1em' }}>
                                        {v('philosophyRole', 'philosophyRole')}
                                    </div>
                                </div>
                                <div style={{
                                    width: '40px', height: '2px',
                                    background: 'var(--accent-gold)',
                                }} />
                            </div>
                        </ScrollReveal3D>
                    </div>
                </section>

                {/* ═══════════════════ JOURNEY TIMELINE ═══════════════════ */}
                <section style={{ padding: 'var(--space-5xl) 0' }}>
                    <div className="container" style={{ maxWidth: '900px' }}>
                        <ScrollReveal3D direction="up" distance={30}>
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
                                <span className="text-label" style={{
                                    marginBottom: 'var(--space-md)', display: 'inline-block',
                                    fontFamily: '"Playfair Display", Georgia, serif',
                                    fontStyle: 'italic',
                                    fontSize: '0.8rem',
                                    letterSpacing: '0.14em',
                                    color: 'rgba(212,168,83,0.65)',
                                }}>
                                    {t('journeyLabel')}
                                </span>
                                <h2 style={{
                                    fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
                                    fontWeight: 800,
                                    lineHeight: 1.2,
                                    fontFamily: 'Outfit, sans-serif',
                                    letterSpacing: '-0.02em',
                                }}>
                                    {t('journeyTitle')}<br />
                                    <span style={{
                                        fontFamily: '"Playfair Display", Georgia, serif',
                                        fontWeight: 700,
                                        fontStyle: 'italic',
                                        letterSpacing: '0.01em',
                                        background: 'linear-gradient(135deg, var(--accent-gold) 0%, #f5d799 30%, #FFE4A0 50%, var(--accent-gold) 100%)',
                                        backgroundSize: '200% auto',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        animation: 'shimmerText 4s linear infinite',
                                    }}>
                                        {t('journeyTitleAccent')}
                                    </span>
                                </h2>
                            </div>
                        </ScrollReveal3D>

                        {/* Timeline */}
                        <div className="about-timeline" tabIndex={0} role="region" aria-label="Company timeline" style={{ position: 'relative', paddingLeft: '60px' }}>
                            {/* Vertical line */}
                            <div style={{
                                position: 'absolute', left: '20px', top: '10px', bottom: '10px',
                                width: '2px',
                                background: 'linear-gradient(to bottom, var(--accent-gold), rgba(212,168,83,0.2), transparent)',
                            }} />

                            {[
                                { year: v('milestone1Year', 'milestone1Year'), title: v('milestone1Title', 'milestone1Title'), desc: v('milestone1Desc', 'milestone1Desc') },
                                { year: v('milestone2Year', 'milestone2Year'), title: v('milestone2Title', 'milestone2Title'), desc: v('milestone2Desc', 'milestone2Desc') },
                                { year: v('milestone3Year', 'milestone3Year'), title: v('milestone3Title', 'milestone3Title'), desc: v('milestone3Desc', 'milestone3Desc') },
                            ].map((milestone, i) => (
                                <ScrollReveal3D key={milestone.year} direction="up" distance={30} delay={i * 200}>
                                    <div style={{
                                        position: 'relative',
                                        marginBottom: i < 2 ? 'var(--space-2xl)' : 0,
                                    }}>
                                        {/* Dot */}
                                        <div className="timeline-dot" style={{
                                            position: 'absolute', left: '-48px', top: '8px',
                                            width: '14px', height: '14px', borderRadius: '50%',
                                            background: 'var(--bg-primary)',
                                            border: '3px solid var(--accent-gold)',
                                            boxShadow: '0 0 20px rgba(212,168,83,0.3)',
                                        }} />

                                        <div style={{
                                            ...glassCard,
                                            padding: 'var(--space-xl) var(--space-2xl)',
                                            transition: 'border-color 0.3s, box-shadow 0.3s',
                                        }}>
                                            <div style={{
                                                display: 'inline-block',
                                                padding: '4px 14px',
                                                background: 'rgba(212,168,83,0.1)',
                                                border: '1px solid rgba(212,168,83,0.2)',
                                                borderRadius: 'var(--radius-full)',
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                color: 'var(--accent-gold)',
                                                letterSpacing: '0.08em',
                                                marginBottom: 'var(--space-sm)',
                                            }}>
                                                {milestone.year}
                                            </div>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>
                                                {milestone.title}
                                            </h3>
                                            <p style={{ fontSize: '0.88rem', lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>
                                                {milestone.desc}
                                            </p>
                                        </div>
                                    </div>
                                </ScrollReveal3D>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ═══════════════════ VALUES ═══════════════════ */}
                <section style={{
                    padding: 'var(--space-5xl) 0',
                    position: 'relative',
                    background: 'linear-gradient(180deg, transparent, rgba(22,24,35,0.25) 20%, rgba(22,24,35,0.25) 80%, transparent)',
                }}>
                    <div className="container" style={{ maxWidth: '1000px' }}>
                        <ScrollReveal3D direction="up" distance={30}>
                            <div style={{ textAlign: 'center', marginBottom: 'var(--space-3xl)' }}>
                                <span className="text-label" style={{ marginBottom: 'var(--space-md)', display: 'inline-block' }}>
                                    {t('valuesLabel')}
                                </span>
                                <h2 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.2rem)', fontWeight: 800, lineHeight: 1.2 }}>
                                    {t('valuesTitle')}{' '}
                                    <span style={{ color: 'var(--accent-gold)' }}>{t('valuesTitleAccent')}</span>
                                </h2>
                            </div>
                        </ScrollReveal3D>

                        <div className="grid-3col" tabIndex={0} role="region" aria-label="Core values" style={{ gap: 'var(--space-xl)' }}>
                            {[
                                {
                                    icon: (
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polygon points="5 3 19 12 5 21 5 3" />
                                        </svg>
                                    ),
                                    title: v('value1Title', 'innovation'), sub: v('value1Sub', 'innovationSub'), desc: v('value1Desc', 'innovationDesc'),
                                },
                                {
                                    icon: (
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                        </svg>
                                    ),
                                    title: v('value2Title', 'inclusivity'), sub: v('value2Sub', 'inclusivitySub'), desc: v('value2Desc', 'inclusivityDesc'),
                                },
                                {
                                    icon: (
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                    ),
                                    title: v('value3Title', 'authenticity'), sub: v('value3Sub', 'authenticitySub'), desc: v('value3Desc', 'authenticityDesc'),
                                },
                            ].map((card, i) => (
                                <ScrollReveal3D key={card.title} direction="up" delay={i * 150} distance={30}>
                                    <div className="about-value-card" style={{
                                        ...glassCard,
                                        padding: 'var(--space-2xl)',
                                        textAlign: 'center',
                                        minHeight: '280px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative',
                                        overflow: 'hidden',
                                        transition: 'border-color 0.4s, transform 0.4s, box-shadow 0.4s',
                                        cursor: 'default',
                                    }}>
                                        {/* Top accent line */}
                                        <div style={{
                                            position: 'absolute', top: 0, left: '20%', right: '20%', height: '2px',
                                            background: 'linear-gradient(to right, transparent, var(--accent-gold), transparent)',
                                            opacity: 0,
                                            transition: 'opacity 0.4s',
                                        }} className="value-card-accent" />

                                        <div style={{
                                            width: '64px', height: '64px',
                                            borderRadius: 'var(--radius-lg)',
                                            background: 'linear-gradient(135deg, rgba(212,168,83,0.1), rgba(212,168,83,0.05))',
                                            border: '1px solid rgba(212,168,83,0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            marginBottom: 'var(--space-lg)',
                                            color: 'var(--accent-gold)',
                                        }}>
                                            {card.icon}
                                        </div>
                                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '4px' }}>{card.title}</h3>
                                        <div style={{
                                            fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-gold)',
                                            textTransform: 'uppercase' as const, letterSpacing: '0.12em',
                                            marginBottom: 'var(--space-md)',
                                        }}>
                                            {card.sub}
                                        </div>
                                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{card.desc}</p>
                                    </div>
                                </ScrollReveal3D>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ═══════════════════ CTA ═══════════════════ */}
                <section style={{
                    padding: 'var(--space-5xl) 0',
                    position: 'relative',
                }}>
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(180deg, transparent 0%, rgba(212,168,83,0.04) 50%, transparent 100%)',
                        pointerEvents: 'none',
                    }} />
                    <div className="container" style={{ maxWidth: '700px', textAlign: 'center', position: 'relative' }}>
                        <ScrollReveal3D direction="up" distance={40}>
                            <h2 style={{
                                fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
                                fontWeight: 800,
                                lineHeight: 1.2,
                                marginBottom: 'var(--space-lg)',
                            }}>
                                {v('ctaTitle', 'ctaTitle')}{' '}
                                <span style={{ color: 'var(--accent-gold)' }}>{v('ctaTitleAccent', 'ctaTitleAccent')}</span>
                            </h2>
                            <p style={{
                                fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.8,
                                marginBottom: 'var(--space-2xl)', maxWidth: '550px', margin: '0 auto var(--space-2xl)',
                            }}>
                                {v('ctaDesc', 'ctaDesc')}
                            </p>
                            <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center', flexWrap: 'wrap' }}>
                                <Link href={isLoggedIn ? "/dashboard" : "/register"} className="btn btn-primary" style={{
                                    padding: '0.9rem 2.5rem',
                                    fontSize: '0.95rem',
                                    fontWeight: 700,
                                }}>
                                    {v('ctaButtonText', 'ctaButton')}
                                </Link>
                                <Link href="/works" className="btn" style={{
                                    padding: '0.9rem 2.5rem',
                                    fontSize: '0.95rem',
                                    fontWeight: 600,
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-primary)',
                                }}>
                                    {v('ctaSecondaryText', 'ctaCasting')}
                                </Link>
                            </div>
                        </ScrollReveal3D>
                    </div>
                </section>

            </main>

            {/* CSS for hover effects and animations */}
            <style>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-20px); }
                }
                @keyframes shimmerText {
                    0% { background-position: 0% center; }
                    100% { background-position: 200% center; }
                }
                .about-value-card:hover {
                    border-color: rgba(212,168,83,0.25) !important;
                    transform: translateY(-4px);
                    box-shadow: 0 20px 60px rgba(212,168,83,0.08);
                }
                .about-value-card:hover .value-card-accent {
                    opacity: 1 !important;
                }
                @media (max-width: 768px) {
                    .about-value-card { min-height: 220px !important; }
                    .about-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
                    .about-mission-grid { grid-template-columns: 1fr !important; }
                    .about-timeline { padding-left: 40px !important; }
                    .about-timeline .timeline-dot { left: -32px !important; }
                }
            `}</style>

            <Footer />
        </>
    )
}
