/**
 * Extracts locale-specific translated fields from a project's translations JSON.
 * Falls back to the original English values when no translation is found.
 *
 * Usage:
 *   const { title, tagline, description, genre } = getLocalizedProject(project, locale)
 */
export function getLocalizedProject<
    T extends { title: string; tagline?: string | null; description?: string; genre?: string | null; translations?: string | null }
>(project: T, locale: string): { title: string; tagline: string | null; description: string; genre: string | null } {
    let tr: Record<string, string> | null = null

    if (locale !== 'en' && project.translations) {
        try {
            tr = JSON.parse(project.translations)?.[locale] || null
        } catch {
            tr = null
        }
    }

    return {
        title: tr?.title || project.title,
        tagline: tr?.tagline || project.tagline || null,
        description: tr?.description || project.description || '',
        genre: tr?.genre || project.genre || null,
    }
}
