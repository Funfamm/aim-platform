/**
 * src/lib/subtitle-status-service.ts — Subtitle status-transition service (SRP Fix).
 *
 * Previously, status-transition logic (markLangsProcessing, checkpointLang, etc.)
 * lived inside subtitle-repo.ts, mixing business rules with persistence.
 *
 * This service owns ALL status-transition logic.
 * subtitle-repo.ts becomes pure CRUD (findSubtitle, upsertSubtitle, updateSubtitleById).
 * Routes call this service — they never touch the repo directly for status transitions.
 *
 * Dependency graph:
 *   Route → SubtitleStatusService → SubtitleRepo (CRUD only)
 */

import {
    findSubtitle,
    updateSubtitleById,
    type SubtitleUpdateData,
} from '@/lib/subtitle-repo'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Cast a plain Record to the shape Prisma Json fields expect.
 * Kept here (not in repo) since it's only needed for status updates.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toJson<T extends object>(value: T): any {
    return value
}

// ── Status transitions ────────────────────────────────────────────────────────

/**
 * Mark a set of languages as 'processing' before a translation job begins.
 * Merges into the existing langStatus so previously-completed langs are preserved.
 *
 * @returns The updated langStatus map (used by the SSE stream for in-memory tracking).
 */
export async function markLangsProcessing(
    id: string,
    langs: string[],
    existingLangStatus: Record<string, string>,
): Promise<Record<string, string>> {
    const updated: Record<string, string> = {
        ...existingLangStatus,
        ...Object.fromEntries(langs.map(l => [l, 'processing'])),
    }
    await updateSubtitleById(id, {
        translateStatus: 'partial',
        langStatus: toJson(updated),
    })
    return updated
}

/**
 * Checkpoint a successfully-translated language.
 * Writes translations + vttPaths + langStatus in a single atomic update.
 */
export async function checkpointLang(
    id: string,
    _lang: string,
    translationsJson: string,
    langStatus: Record<string, string>,
    vttPaths: Record<string, string>,
    generatedWith?: string,
): Promise<void> {
    await updateSubtitleById(id, {
        translations: translationsJson,
        langStatus: toJson(langStatus),
        vttPaths: toJson(vttPaths),
        ...(generatedWith ? { generatedWith } : {}),
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
    await updateSubtitleById(id, {
        langStatus: toJson({ ...existingLangStatus, [lang]: 'failed' }),
    })
}

/**
 * Final update after all languages in a bulk job have been processed.
 * Sets translateStatus to 'complete' or 'partial'.
 */
export async function finalizeTranslation(
    id: string,
    translateStatus: 'complete' | 'partial',
    langStatus: Record<string, string>,
    vttPaths: Record<string, string>,
): Promise<void> {
    await updateSubtitleById(id, {
        translateStatus,
        status: 'completed',
        langStatus: toJson(langStatus),
        vttPaths: toJson(vttPaths),
    })
}

/**
 * Finalize a single-language retry.
 * Caller determines whether all languages are now done and passes translateStatus directly.
 */
export async function finalizeSingleLang(
    id: string,
    lang: string,
    translationsJson: string,
    existingLangStatus: Record<string, string>,
    vttPaths: Record<string, string>,
    translateStatus: 'complete' | 'partial',
): Promise<void> {
    await updateSubtitleById(id, {
        translations: translationsJson,
        langStatus: toJson({ ...existingLangStatus, [lang]: 'completed' }),
        vttPaths: toJson(vttPaths),
        translateStatus,
    })
}

/**
 * Convenience: load a subtitle record and check if a job is already running.
 * Used by routes before starting a new translation job (rate-limit guard).
 */
export async function isJobAlreadyRunning(
    projectId: string,
    episodeId?: string | null,
): Promise<boolean> {
    const subtitle = await findSubtitle(projectId, episodeId)
    if (!subtitle) return false
    const langStatus = (subtitle.langStatus as Record<string, string> | null) ?? {}
    return Object.values(langStatus).some(s => s === 'processing')
}
