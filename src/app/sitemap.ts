import { MetadataRoute } from 'next'
import { prisma } from '@/lib/db'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
  const locales = ['en', 'es', 'fr', 'ar', 'zh', 'hi', 'pt', 'ru', 'ja', 'de', 'ko']

  // ── Static pages ──────────────────────────────────────────────────────
  const staticPages = [
    '',           // homepage
    '/works',
    '/upcoming',
    '/casting',
    '/scripts',
    '/training',
    '/about',
    '/contact',
    '/donate',
    '/sponsors',
    '/events',
    '/start-project',
  ]

  const staticEntries: MetadataRoute.Sitemap = []
  for (const page of staticPages) {
    for (const locale of locales) {
      const path = locale === 'en' ? page : `/${locale}${page}`
      staticEntries.push({
        url: `${baseUrl}${path}`,
        lastModified: new Date(),
        changeFrequency: page === '' ? 'daily' : 'weekly',
        priority: page === '' ? 1.0 : 0.8,
        alternates: {
          languages: Object.fromEntries(
            locales.map(l => [l, `${baseUrl}${l === 'en' ? '' : `/${l}`}${page}`])
          ),
        },
      })
    }
  }

  // ── Dynamic: Published projects ───────────────────────────────────────
  let projectEntries: MetadataRoute.Sitemap = []
  try {
    const projects = await prisma.project.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    })

    for (const project of projects) {
      for (const locale of locales) {
        const prefix = locale === 'en' ? '' : `/${locale}`
        projectEntries.push({
          url: `${baseUrl}${prefix}/works/${project.slug}`,
          lastModified: project.updatedAt,
          changeFrequency: 'weekly',
          priority: 0.9,
        })
      }
    }
  } catch {
    // DB unavailable at build time (e.g. missing DATABASE_URL) - skip dynamic entries
  }

  // ── Dynamic: Open casting calls ───────────────────────────────────────
  let castingEntries: MetadataRoute.Sitemap = []
  try {
    const castingCalls = await prisma.castingCall.findMany({
      where: { status: 'open' },
      select: { id: true, updatedAt: true },
    })

    castingEntries = castingCalls.flatMap(call =>
      locales.map(locale => ({
        url: `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/casting/${call.id}`,
        lastModified: call.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }))
    )
  } catch {
    // DB unavailable - skip
  }

  // ── Dynamic: Published courses ────────────────────────────────────────
  let courseEntries: MetadataRoute.Sitemap = []
  try {
    const courses = await prisma.course.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    })

    courseEntries = courses.flatMap(course =>
      locales.map(locale => ({
        url: `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/training/${course.slug}`,
        lastModified: course.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }))
    )
  } catch {
    // DB unavailable - skip
  }

  return [...staticEntries, ...projectEntries, ...castingEntries, ...courseEntries]
}
