import Link from 'next/link'
import dynamic from 'next/dynamic'
import Footer from '@/components/Footer'
import HomeHero from '@/components/HomeHero'
const Scene3D = dynamic(() => import('@/components/Scene3D'))
const FeaturedProjects3D = dynamic(() => import('@/components/FeaturedProjects3D'))
const RollRow = dynamic(() => import('@/components/mobile/RollRow'))
import ScrollReveal3D from '@/components/ScrollReveal3D'
import SponsorBannerSection from '@/components/SponsorBannerSection'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { sanitizeBigInt } from '@/lib/serializer'
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
  const [featuredProjects, completedCount, upcomingCount, openCastings, homeSponsors, siteSettings, rawRolls] = await safeQuery(() =>
    Promise.all([
      prisma.project.findMany({
        where: { featured: true, published: true },
        orderBy: { sortOrder: 'asc' },
      }),
      prisma.project.count({ where: { status: 'completed', published: true } }),
      prisma.project.count({ where: { status: 'upcoming', published: true } }),
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
      prisma.siteSettings.findFirst({ select: { castingCallsEnabled: true, allowPublicTrailers: true } }).catch(() => null),
      prisma.movieRoll.findMany({
        where: {
          visible: true,
          displayOn: { in: ['homepage', 'both'] },
        },
        orderBy: { sortOrder: 'asc' },
        include: { projects: { orderBy: { sortOrder: 'asc' }, select: { projectId: true, sortOrder: true } } },
      }),
    ])
  );

  // Enforce trailer access control
  const session = await getUserSession()
  const isLoggedIn = !!session?.userId
  const showTrailer = (siteSettings?.allowPublicTrailers !== false) || isLoggedIn

  // Resolve localized sponsor descriptions
  const localizedSponsors = homeSponsors.map((s: { id: string; name: string; logoUrl: string | null; bannerUrl: string | null; website: string | null; tier: string; description: string | null; descriptionI18n: unknown; bannerDurationHours: number }) => {
    const i18n = s.descriptionI18n as Record<string, string> | null
    return { ...s, description: i18n?.[locale] || i18n?.['en'] || s.description, descriptionI18n: undefined }
  })

  // Normalize homepage rolls — two-step: first collect all projectIds, then batch-fetch
  const allRollProjectIds = [...new Set(rawRolls.flatMap((r: { projects: Array<{ projectId: string }> }) => r.projects.map(p => p.projectId)))] as string[]
  const rollProjects = allRollProjectIds.length > 0
    ? await prisma.project.findMany({
        where: { id: { in: allRollProjectIds }, published: true },
        include: { _count: { select: { episodes: true } } },
      })
    : [] as Awaited<ReturnType<typeof prisma.project.findMany>>
  const rollProjectMap = new Map(rollProjects.map(p => [p.id, { ...sanitizeBigInt({ ...p, _count: undefined }), episodeCount: (p as typeof p & { _count: { episodes: number } })._count?.episodes ?? 0 }]))

  const homeRolls = rawRolls
    .map((roll: { id: string; title: string; titleI18n: unknown; icon: string; slug: string; projects: Array<{ projectId: string; sortOrder: number }> }) => ({
      id:        roll.id,
      title:     roll.title,
      titleI18n: roll.titleI18n as string | null,
      icon:      roll.icon,
      slug:      roll.slug,
      projects:  roll.projects
        .map(rp => rollProjectMap.get(rp.projectId))
        .filter(Boolean),
    }))
    .filter((roll: { projects: unknown[] }) => roll.projects.length > 0)

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
        castingEnabled={siteSettings?.castingCallsEnabled ?? true}
      />

      {/* ═══ All content below scrolls OVER the fixed hero video ═══ */}
      {/* background starts transparent so the hero fades in softly, then goes solid */}
      <div style={{ position: 'relative', zIndex: 2, background: 'linear-gradient(180deg, transparent 0px, var(--bg-primary) 220px)' }} tabIndex={0} role="region" aria-label="Page content">

      {/* ═══ FEATURED WORKS ═══ */}
      <section className="section" style={{ position: 'relative', paddingBottom: 0 }}>
        {/* Dark overlay behind cards — full-bleed, ensures readability over hero video */}
        <div style={{
          position: 'absolute',
          top: 0, left: '50%', right: 0, bottom: 0,
          width: '100vw',
          transform: 'translateX(-50%)',
          background: 'linear-gradient(180deg, transparent 0%, rgba(13,15,20,0.7) 6%, rgba(13,15,20,0.92) 15%, rgba(13,15,20,0.97) 30%, var(--bg-primary) 50%)',
          pointerEvents: 'none',
          zIndex: 0,
        }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          {/* ── Cinematic section header — no card, text breathes freely ── */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-xl)', position: 'relative' }}>

            {/* Decorative side lines flanking the label */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginBottom: '18px' }}>
              <div style={{
                flex: 1, maxWidth: '80px', height: '1px',
                background: 'linear-gradient(to right, transparent, rgba(212,168,83,0.55))',
              }} />
              <span style={{
                fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.22em',
                textTransform: 'uppercase', color: 'var(--accent-gold)',
                opacity: 0.9,
              }}>{t('portfolio')}</span>
              <div style={{
                flex: 1, maxWidth: '80px', height: '1px',
                background: 'linear-gradient(to left, transparent, rgba(212,168,83,0.55))',
              }} />
            </div>

            <h2 style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: 800,
              marginBottom: '14px',
              lineHeight: 1.1,
              letterSpacing: '-0.01em',
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

            <p style={{
              fontSize: '0.88rem',
              color: 'rgba(255,255,255,0.52)',
              maxWidth: '360px',
              margin: '0 auto',
              lineHeight: 1.6,
              letterSpacing: '0.01em',
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
            trailerUrl: showTrailer ? p.trailerUrl : null,
            translations: p.translations,
          }))} />


          <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
            <Link href="/works" className="btn btn-secondary">
              {t('viewAllWorks')}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ CURATED ROLL ROWS (admin-defined) ═══ */}
      {homeRolls.length > 0 && (
        <section className="mobile-only" style={{ position: 'relative', zIndex: 2, background: 'var(--bg-primary)', padding: '0 0 var(--space-2xl)' }}>
          <div className="container">
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              marginBottom: 'var(--space-lg)',
              paddingTop: 'var(--space-lg)',
            }}>
              <div style={{ width: '24px', height: '2px', background: 'var(--accent-gold)', borderRadius: '2px' }} />
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent-gold)' }}>
                {t('curatedCollections')}
              </span>
            </div>
            {(homeRolls as Array<{ id: string; title: string; titleI18n: string | null; icon: string; slug: string; projects: unknown[] }>).map((roll) => (
              <RollRow
                key={roll.id}
                title={roll.title}
                titleI18n={roll.titleI18n}
                icon={roll.icon}
                projects={roll.projects as unknown as import('@/components/mobile/MovieCard').ProjectCard[]}
                locale={locale}
              />
            ))}
          </div>
        </section>
      )}

      {/* ═══ SPONSORS & CASTING CTA ═══ */}
      <SponsorBannerSection sponsors={localizedSponsors} />

      </div>{/* end scrolling content wrapper */}

      <Footer />
    </main>
  )
}
