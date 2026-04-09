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

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  // Helper to retry a Prisma query once if it fails due to a transient DB error.
  const safeQuery = async (fn: () => Promise<any>, retries = 1, delayMs = 500): Promise<any> => {
    try {
      return await fn();
    } catch (err) {
      if (retries > 0) {
        // Simple exponential backoff; fixed short delay.
        await new Promise((res) => setTimeout(res, delayMs));
        return safeQuery(fn, retries - 1, delayMs * 2);
      }
      throw err;
    }
  };
  const [featuredProjects, completedCount, upcomingCount, openCastings, homeSponsors] = await safeQuery(() =>
    Promise.all([
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
          id: true,
          name: true,
          logoUrl: true,
          bannerUrl: true,
          website: true,
          tier: true,
          description: true,
          descriptionI18n: true,
          bannerDurationHours: true,
        },
      }),
    ])
  );

  // Resolve localized sponsor descriptions
  const localizedSponsors = homeSponsors.map((s: { id: string; name: string; logoUrl: string | null; bannerUrl: string | null; website: string | null; tier: string; description: string | null; descriptionI18n: unknown; bannerDurationHours: number }) => {
    const i18n = s.descriptionI18n as Record<string, string> | null
    return { ...s, description: i18n?.[locale] || i18n?.['en'] || s.description, descriptionI18n: undefined }
  })

  type Project = typeof featuredProjects[number]

  const t = await getTranslations('home')

  return (
    <main id="main-content">
      <Scene3D />
<div id="hero-anchor" />

      <HomeHero
        completedCount={completedCount}
        upcomingCount={upcomingCount}
        openCastings={openCastings}
      />

      {/* ═══ All content below scrolls OVER the fixed hero video ═══ */}
      <div style={{ position: 'relative', zIndex: 2 }} tabIndex={0} role="region" aria-label="Page content">

      {/* ═══ FEATURED WORKS ═══ */}
      <section className="section" style={{ position: 'relative', paddingBottom: 'var(--space-lg)' }}>
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
          <div className="glass-panel" style={{
            textAlign: 'center', marginBottom: 'var(--space-xl)',
            backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-xl)',
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



      {/* ═══ SPONSORS & CASTING CTA ═══ */}
      <SponsorBannerSection sponsors={localizedSponsors} />

      </div>{/* end scrolling content wrapper */}

      <Footer />
    </main>
  )
}
