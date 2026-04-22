import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { searchStaticPages } from '@/lib/staticPages'

export const dynamic = 'force-dynamic'

const RESULTS_PER_CATEGORY = 3

// Simple in-memory cache: key → { data, expiry }
const cache = new Map<string, { data: SearchResult[]; expiry: number }>()
const CACHE_TTL_MS = 30_000 // 30 seconds

type SearchResult = {
  category: string
  icon: string
  title: string
  subtitle: string
  href: string
}

/**
 * GET /api/search?q=<query>&locale=<locale>
 * Searches across Projects, CastingCalls, Courses, ScriptCalls, Sponsors, and static pages.
 * Returns max 3 results per category. Public endpoint (no auth required).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawQuery = searchParams.get('q')?.trim() ?? ''
  const locale = searchParams.get('locale') ?? 'en'

  // Validate query
  if (rawQuery.length < 2 || rawQuery.length > 100) {
    return NextResponse.json({ results: [], query: rawQuery, total: 0 })
  }

  // Sanitize — strip special characters that could cause Prisma issues
  const q = rawQuery.replace(/[%_\\]/g, '')

  // Check cache
  const cacheKey = `${q.toLowerCase()}:${locale}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json({ results: cached.data, query: rawQuery, total: cached.data.length })
  }

  try {
    // Fetch site settings to know which sections are enabled
    const settings = await prisma.siteSettings.findFirst({ where: { id: 'default' } })
    const castingEnabled = settings?.castingCallsEnabled ?? true
    const trainingEnabled = settings?.trainingEnabled ?? false
    const scriptCallsEnabled = settings?.scriptCallsEnabled ?? false

    const results: SearchResult[] = []

    // ── 1. Projects (always searched) ──
    const projects = await prisma.project.findMany({
      where: {
        published: true,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { tagline: { contains: q, mode: 'insensitive' } },
          { genre: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { title: true, slug: true, tagline: true, genre: true, year: true, translations: true },
      take: RESULTS_PER_CATEGORY,
      orderBy: { sortOrder: 'asc' },
    })

    for (const p of projects) {
      // Check translated title if locale isn't English
      let displayTitle = p.title
      let displaySubtitle = [p.genre, p.year].filter(Boolean).join(' • ')
      if (locale !== 'en' && p.translations) {
        try {
          const trans = JSON.parse(p.translations as string)
          if (trans[locale]?.title) displayTitle = trans[locale].title
          if (trans[locale]?.tagline) displaySubtitle = trans[locale].tagline
        } catch { /* ignore parse errors */ }
      }
      results.push({
        category: 'Films',
        icon: '🎬',
        title: displayTitle,
        subtitle: displaySubtitle || 'Film',
        href: `/works/${p.slug}`,
      })
    }

    // Also search translated project titles for non-English locales
    if (locale !== 'en' && results.filter(r => r.category === 'Films').length < RESULTS_PER_CATEGORY) {
      const allProjects = await prisma.project.findMany({
        where: { published: true, translations: { not: null } },
        select: { title: true, slug: true, tagline: true, genre: true, year: true, translations: true },
        take: 50, // scan a reasonable number
      })
      for (const p of allProjects) {
        if (results.some(r => r.href === `/works/${p.slug}`)) continue
        if (results.filter(r => r.category === 'Films').length >= RESULTS_PER_CATEGORY) break
        try {
          const trans = JSON.parse(p.translations as string)
          const localeData = trans[locale]
          if (localeData) {
            const titleMatch = localeData.title?.toLowerCase().includes(q.toLowerCase())
            const taglineMatch = localeData.tagline?.toLowerCase().includes(q.toLowerCase())
            if (titleMatch || taglineMatch) {
              results.push({
                category: 'Films',
                icon: '🎬',
                title: localeData.title || p.title,
                subtitle: localeData.tagline || [p.genre, p.year].filter(Boolean).join(' • ') || 'Film',
                href: `/works/${p.slug}`,
              })
            }
          }
        } catch { /* ignore */ }
      }
    }

    // ── 2. Casting Calls (if enabled) ──
    if (castingEnabled) {
      const castingCalls = await prisma.castingCall.findMany({
        where: {
          status: 'open',
          OR: [
            { roleName: { contains: q, mode: 'insensitive' } },
            { roleDescription: { contains: q, mode: 'insensitive' } },
            { roleType: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true, roleName: true, roleType: true, translations: true,
          project: { select: { title: true, translations: true } },
        },
        take: RESULTS_PER_CATEGORY,
      })

      for (const c of castingCalls) {
        let displayRole = c.roleName
        let displayProject = c.project.title
        if (locale !== 'en') {
          try {
            if (c.translations) {
              const trans = JSON.parse(c.translations as string)
              if (trans[locale]?.roleName) displayRole = trans[locale].roleName
            }
            if (c.project.translations) {
              const ptrans = JSON.parse(c.project.translations as string)
              if (ptrans[locale]?.title) displayProject = ptrans[locale].title
            }
          } catch { /* ignore */ }
        }
        results.push({
          category: 'Casting',
          icon: '🎭',
          title: `${displayRole} — ${c.roleType}`,
          subtitle: displayProject,
          href: '/casting',
        })
      }
    }

    // ── 3. Courses (if enabled) ──
    if (trainingEnabled) {
      const courses = await prisma.course.findMany({
        where: {
          published: true,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { category: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { title: true, slug: true, category: true, translations: true },
        take: RESULTS_PER_CATEGORY,
      })

      for (const c of courses) {
        let displayTitle = c.title
        if (locale !== 'en' && c.translations) {
          try {
            const trans = JSON.parse(c.translations as string)
            if (trans[locale]?.title) displayTitle = trans[locale].title
          } catch { /* ignore */ }
        }
        results.push({
          category: 'Training',
          icon: '📚',
          title: displayTitle,
          subtitle: c.category.charAt(0).toUpperCase() + c.category.slice(1),
          href: `/training/${c.slug}`,
        })
      }
    }

    // ── 4. Script Calls (if enabled) ──
    if (scriptCallsEnabled) {
      const scriptCalls = await prisma.scriptCall.findMany({
        where: {
          isPublic: true,
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, genre: true },
        take: RESULTS_PER_CATEGORY,
      })

      for (const s of scriptCalls) {
        results.push({
          category: 'Scripts',
          icon: '✍️',
          title: s.title,
          subtitle: s.genre || 'Script Call',
          href: `/scripts/${s.id}`,
        })
      }
    }

    // ── 5. Sponsors (active only) ──
    const sponsors = await prisma.sponsor.findMany({
      where: {
        active: true,
        name: { contains: q, mode: 'insensitive' },
      },
      select: { name: true, tier: true },
      take: RESULTS_PER_CATEGORY,
    })

    for (const s of sponsors) {
      results.push({
        category: 'Sponsors',
        icon: '⭐',
        title: s.name,
        subtitle: `${s.tier.charAt(0).toUpperCase() + s.tier.slice(1)} Sponsor`,
        href: '/sponsors',
      })
    }

    // ── 6. Static Pages ──
    const staticMatches = searchStaticPages(q, RESULTS_PER_CATEGORY)
    for (const page of staticMatches) {
      results.push({
        category: 'Pages',
        icon: page.icon,
        title: page.title,
        subtitle: page.subtitle,
        href: page.href,
      })
    }

    // Cache result
    cache.set(cacheKey, { data: results, expiry: Date.now() + CACHE_TTL_MS })

    // Evict old entries (keep cache small)
    if (cache.size > 200) {
      const now = Date.now()
      for (const [key, val] of cache) {
        if (val.expiry < now) cache.delete(key)
      }
    }

    return NextResponse.json({ results, query: rawQuery, total: results.length })
  } catch (error) {
    console.error('[Search API] Error:', error)
    return NextResponse.json({ results: [], query: rawQuery, total: 0, error: 'Search unavailable' }, { status: 500 })
  }
}
