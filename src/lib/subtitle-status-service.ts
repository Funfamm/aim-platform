/**
 * src/lib/subtitle-status-service.ts — Subtitle status-transition service (SRP fix).
 *
 * Owns ALL status-transition business logic.
 * subtitle-repo.ts is pure CRUD.
 * Both use toJson from shared prisma-utils.ts (DRY fix — Gap 6).
 *
 * Changes vs previous version:
 * - toJson imported from prisma-utils (no more duplicate local definition)
 * - Removed isJobAlreadyRunning (was dead — never called by routes; route
 *   performs the same check inline against already-loaded data, avoiding
 *   an extra DB round-trip)
 * - Added computeTranslateStatus (pure function) + upsertSubtitleRecord (Gap 1 fix)
 *
 * Dependency graph:
 *   Routes → SubtitleStatusService → SubtitleRepo (CRUD only)
 */

import {
    findSubtitle,
    upsertSubtitle,
    updateSubtitleById,
    type UpsertSubtitleData,
    type SubtitleUpdateData,
} from '@/lib/subtitle-repo'
import { toJson } from '@/lib/prisma-utils'

// ── Pure business logic ───────────────────────────────────────────────────────

/**
 * Compute the correct translateStatus for a subtitle upsert.
 *
 * Rules:
 * - If translations are included → 'complete'
 * - If no translations but existing status was already partial/complete → preserve it
 * - Otherwise → 'pending'
 *
 * Previously this logic lived inside subtitle-repo's upsertSubtitle,
 * mixing business rules with persistence. Now it's a pure function here.
 */
export function computeTranslateStatus(
    hasTranslations: boolean,
    existingTranslateStatus: string | null | undefined,
): string {
    if (hasTranslations) return 'complete'
    if (existingTranslateStatus === 'partial' || existingTranslateStatus === 'complete') {
        return existingTranslateStatus
    }
    return 'pending'
}

/**
 * Service-level upsert — applies the translateStatus business rule before
 * delegating to the repo.
 *
 * Callers (routes) should use this instead of upsertSubtitle from the repo
 * when they want the standard status-preservation behaviour.
 * The repo's upsertSubtitle now only writes exactly what it's given.
 */
export async function upsertSubtitleRecord(
    data: Omit<UpsertSubtitleData, 'translateStatus'>,
): Promise<ReturnType<typeof upsertSubtitle>> {
    const existing = await findSubtitle(data.projectId, data.episodeId)
    const translateStatus = computeTranslateStatus(
        !!data.translations,
        existing?.translateStatus ?? null,
    )
    return upsertSubtitle({ ...data, translateStatus })
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

// Re-export types callers may need
export type { UpsertSubtitleData, SubtitleUpdateData }
