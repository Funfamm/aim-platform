/**
 * subtitle-repo.ts — Repository layer for FilmSubtitle DB operations.
 *
 * Single source of truth for all Prisma reads/writes touching FilmSubtitle.
 * Routes import these functions instead of calling prisma directly, satisfying DIP.
 *
 * All functions are typed against the actual Prisma shape; callers receive
 * plain objects they can use without knowing Prisma's internals.
 */

import { prisma } from '@/lib/db'

export type SubtitleSegment = { start: number; end: number; text: string }

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Find the subtitle record for a project (and optional episode).
 * Returns null if no record exists yet.
 */
export async function findSubtitle(projectId: string, episodeId?: string | null) {
    return prisma.filmSubtitle.findFirst({
        where: { projectId, episodeId: episodeId ?? null },
    })
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * Mark a set of languages as 'processing' before a translation job begins.
 * Merges into the existing langStatus so previously-completed langs are preserved.
 */
export async function markLangsProcessing(
    id: string,
    langs: string[],
    existingLangStatus: Record<string, string>,
): Promise<Record<string, string>> {
    const updated = {
        ...existingLangStatus,
        ...Object.fromEntries(langs.map(l => [l, 'processing'])),
    }
    await prisma.filmSubtitle.update({
        where: { id },
        data: { translateStatus: 'partial', langStatus: updated },
    })
    return updated
}

/**
 * Checkpoint a successfully-translated language.
 * Writes translations + vttPaths + langStatus in a single atomic update.
 */
export async function checkpointLang(
    id: string,
    lang: string,
    translationsJson: string,
    langStatus: Record<string, string>,
    vttPaths: Record<string, string>,
    generatedWith?: string,
): Promise<void> {
    await prisma.filmSubtitle.update({
        where: { id },
        data: {
            translations: translationsJson,
            langStatus,
            vttPaths,
            ...(generatedWith ? { generatedWith } : {}),
        },
    })
}

/**
 * Mark a single language as 'failed'.
 */
export async function failLang(
    id: string,
    lang: string,
    existingLangStatus: Record<string, string>,
): Promise<void> {
    await prisma.filmSubtitle.update({
        where: { id },
        data: { langStatus: { ...existingLangStatus, [lang]: 'failed' } },
    })
}

/**
 * Final update after all languages have been processed.
 * Sets translateStatus to 'complete' or 'partial' and persists final langStatus/vttPaths.
 */
export async function finalizeTranslation(
    id: string,
    translateStatus: 'complete' | 'partial',
    langStatus: Record<string, string>,
    vttPaths: Record<string, string>,
): Promise<void> {
    await prisma.filmSubtitle.update({
        where: { id },
        data: {
            translateStatus,
            status: 'completed',
            langStatus,
            vttPaths,
        },
    })
}

/**
 * Finalize a single-language retry — writes translations, langStatus, vttPaths,
 * and recomputes translateStatus.
 */
export async function finalizeSingleLang(
    id: string,
    lang: string,
    translationsJson: string,
    existingLangStatus: Record<string, string>,
    vttPaths: Record<string, string>,
    allTargetLangs: readonly string[],
    allTranslations: Record<string, SubtitleSegment[]>,
): Promise<void> {
    const allDone = allTargetLangs.every(l => !!allTranslations[l])
    await prisma.filmSubtitle.update({
        where: { id },
        data: {
            translations: translationsJson,
            langStatus: { ...existingLangStatus, [lang]: 'completed' },
            vttPaths,
            translateStatus: allDone ? 'complete' : 'partial',
        },
    })
}
