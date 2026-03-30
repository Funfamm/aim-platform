import Link from 'next/link'
import dynamic from 'next/dynamic'
import Footer from '@/components/Footer'
import HomeHero from '@/components/HomeHero'
const Scene3D = dynamic(() => import('@/components/Scene3D'))
const FeaturedProjects3D = dynamic(() => import('@/components/FeaturedProjects3D'))
import ScrollReveal3D from '@/components/ScrollReveal3D'
import SponsorBannerSection from '@/components/SponsorBannerSection'
import { prisma } from '@/lib/db'
import { getTranslations } from 'next-intl/server'

// ISR: regenerate at most every 60 seconds
export const revalidate = 60

export default async function HomePage() {
  const [featuredProjects, completedCount, upcomingCount, openCastings, homeSponsors] = await Promise.all([
    prisma.project.findMany({
      where: { featured: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.project.count({ where: { status: 'completed' } }),
    prisma.project.count({ where: { status: 'upcoming' } }),
    prisma.castingCall.count({ where: { status: 'open' } }),

    prisma.sponsor.findMany({
      where: {
        active: true,
        OR: [
          { displayOn: { in: ['homepage', 'all'] } },
          { featured: true },
        ],
        AND: [
          { OR: [{ endDate: null }, { endDate: { gte: new Date() } }] },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true, name: true, logoUrl: true, bannerUrl: true,
        website: true, tier: true, description: true, bannerDurationHours: true,
      },
    }),
  ])

  type Project = typeof featuredProjects[number]

  const t = await getTranslations('home')

  return (
    <>
      <Scene3D />
<div id="main-content" />

      <HomeHero
        completedCount={completedCount}
        upcomingCount={upcomingCount}
        openCastings={openCastings}
      />

      {/* ═══ All content below scrolls OVER the fixed hero video ═══ */}
      <div style={{ position: 'relative', zIndex: 2 }}>

      {/* ═══ FEATURED WORKS ═══ */}
      <section className="section" style={{ position: 'relative' }}>
        {/* Subtle section background */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '800px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(212,168,83,0.03) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div className="container">
          <div style={{
            textAlign: 'center', marginBottom: 'var(--space-xl)',
            background: 'rgba(13,15,20,0.6)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-xl)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span className="text-label" style={{ display: 'block', marginBottom: '6px' }}>{t('portfolio')}</span>
            <h2 style={{
              fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
              fontWeight: 800,
              marginBottom: '6px',
            }}>
              {t('featured')}{' '}
              <span style={{
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>{t('featuredAccent')}</span>
            </h2>
            <div className="divider divider-center" style={{ marginBottom: '8px' }} />
            <p style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              maxWidth: '400px',
              margin: '0 auto',
              lineHeight: 1.5,
            }}>
              {t('featuredDesc')}
            </p>
          </div>

          <FeaturedProjects3D projects={featuredProjects.map((p: typeof featuredProjects[number]) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            tagline: p.tagline,
            genre: p.genre,
            coverImage: p.coverImage,
            trailerUrl: p.trailerUrl,
            translations: p.translations,
          }))} />


          <div style={{ textAlign: 'center', marginTop: 'var(--space-2xl)' }}>
            <Link href="/works" className="btn btn-secondary">
              {t('viewAllWorks')}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ ABOUT / VISION ═══ */}
      <section className="section" style={{ position: 'relative' }}>
        <div className="container">
          {/* Section header — centered */}
          <ScrollReveal3D direction="up" delay={100} distance={30}>
            <div style={{
              textAlign: 'center', marginBottom: 'var(--space-3xl)',
              background: 'rgba(13,15,20,0.6)',
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-xl)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <span className="text-label">{t('ourVision')}</span>
              <h2 style={{
                marginTop: 'var(--space-sm)',
                marginBottom: 'var(--space-md)',
                fontSize: 'clamp(1.8rem, 4.5vw, 2.8rem)',
                fontWeight: 800,
                lineHeight: 1.15,
              }}>
                {t('redefining')}{' '}
                <span style={{
                  fontFamily: 'var(--font-serif)', fontStyle: 'italic',
                  background: 'linear-gradient(135deg, var(--accent-gold-light), var(--accent-gold))',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
                }}>{t('redefiningAccent')}</span>
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
                {t('visionP1')}
              </p>
            </div>
          </ScrollReveal3D>

          {/* Feature cards grid */}
          <div className="grid-3" style={{
            gap: 'var(--space-lg)',
          }}>
            {[
              {
                icon: '🎯',
                value: t('zeroCompromise'),
                desc: t('visionP2'),
                gradient: 'linear-gradient(135deg, rgba(212,168,83,0.15), rgba(13,15,20,0.7))',
                border: 'rgba(212,168,83,0.25)',
              },
              {
                icon: '✨',
                value: t('limitless'),
                desc: t('limitlessDesc'),
                gradient: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(13,15,20,0.7))',
                border: 'rgba(139,92,246,0.25)',
              },
              {
                icon: '🎬',
                value: t('cinematic'),
                desc: t('cinematicDesc'),
                gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(13,15,20,0.7))',
                border: 'rgba(59,130,246,0.25)',
              },
            ].map((card, i) => (
              <ScrollReveal3D key={i} direction="up" delay={200 + i * 150} distance={30} rotate={3}>
                <div style={{
                  padding: 'var(--space-xl)',
                  borderRadius: 'var(--radius-xl)',
                  background: card.gradient,
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
                    fontFamily: 'var(--font-display)',
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
            <div className="home-stats-row" style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 'var(--space-3xl)',
              marginTop: 'var(--space-3xl)',
              padding: 'var(--space-xl)',
              background: 'rgba(13,15,20,0.6)',
              backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {[
                { value: '100%', label: t('zeroCompromise') },
                { value: '∞', label: t('limitless') },
                { value: '24fps', label: t('cinematic') },
              ].map((stat, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <div style={{
                    fontFamily: 'var(--font-display)',
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

      {/* ═══ SPONSORS & CASTING CTA ═══ */}
      <SponsorBannerSection sponsors={homeSponsors} />

      </div>{/* end scrolling content wrapper */}

      <Footer />
    </>
  )
}
