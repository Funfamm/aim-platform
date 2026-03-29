/**
 * Centralized static page definitions for search.
 * Used by both the API and client-side for instant matching.
 */
export type StaticPage = {
  title: string
  keywords: string[]
  href: string
  subtitle: string
  icon: string
}

export const STATIC_PAGES: StaticPage[] = [
  { title: 'About Us', keywords: ['about', 'story', 'mission', 'team', 'who', 'aim'], href: '/about', subtitle: 'Our story and mission', icon: '📄' },
  { title: 'Contact', keywords: ['contact', 'email', 'reach', 'message', 'support', 'help'], href: '/contact', subtitle: 'Get in touch with us', icon: '📄' },
  { title: 'Donate', keywords: ['donate', 'support', 'fund', 'contribute', 'give', 'donation'], href: '/donate', subtitle: 'Support our projects', icon: '📄' },
  { title: 'Subscribe', keywords: ['subscribe', 'notify', 'newsletter', 'updates', 'signup'], href: '/subscribe', subtitle: 'Stay updated on releases', icon: '📄' },
  { title: 'Sponsors', keywords: ['sponsor', 'partner', 'brand', 'sponsorship'], href: '/sponsors', subtitle: 'Our partners & supporters', icon: '📄' },
  { title: 'Our Works', keywords: ['works', 'films', 'movies', 'portfolio', 'productions', 'watch'], href: '/works', subtitle: 'Browse all productions', icon: '📄' },
  { title: 'Coming Soon', keywords: ['upcoming', 'coming', 'next', 'soon', 'future', 'planned'], href: '/upcoming', subtitle: 'Future productions', icon: '📄' },
  { title: 'My Dashboard', keywords: ['dashboard', 'profile', 'account', 'settings', 'my'], href: '/dashboard', subtitle: 'Your personal dashboard', icon: '📄' },
]

/**
 * Search static pages — returns matches where query matches title or any keyword.
 */
export function searchStaticPages(query: string, limit = 3): StaticPage[] {
  const q = query.toLowerCase().trim()
  if (!q) return []

  return STATIC_PAGES
    .filter(page =>
      page.title.toLowerCase().includes(q) ||
      page.keywords.some(kw => kw.includes(q))
    )
    .slice(0, limit)
}
