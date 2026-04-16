/**
 * subtitle-repo.ts — Repository layer for FilmSubtitle DB operations.
 *
 * Single source of truth for all Prisma reads/writes touching FilmSubtitle.
 * Routes import these functions instead of calling prisma directly (DIP).
 *
 * Prisma Json? fields (langStatus, vttPaths) require explicit cast to
 * Prisma.InputJsonValue — plain TS objects are not assignable without the cast.
 */

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

export type SubtitleSegment = { start: number; end: number; text: string }

/** Input shape for create/update subtitle record (upsert) */
export type UpsertSubtitleData = {
    projectId: string
    episodeId?: string | null
    language?: string
    segments: string
    translations?: string | null
    status?: string
    translateStatus?: string
    transcribedWith?: string
    qcIssues?: string | null
}

// ── Internal helper ───────────────────────────────────────────────────────────

/**
 * Cast a plain Record to Prisma.InputJsonValue so Json? fields accept it.
 * This is the canonical way to assign typed objects to Prisma Json fields.
 */
function toJson<T extends object>(value: T): Prisma.InputJsonValue {
    return value as unknown as Prisma.InputJsonValue
}

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
 * Upsert a subtitle record — create if none exists, update otherwise.
 * Used by the admin POST /api/admin/subtitles route after transcription completes.
 * Preserves existing translateStatus if partial/complete (never resets progress).
 */
export async function upsertSubtitle(data: UpsertSubtitleData) {
    const { projectId, episodeId, ...fields } = data
    const existing = await findSubtitle(projectId, episodeId)

    if (existing) {
        return prisma.filmSubtitle.update({
            where: { id: existing.id },
            data: {
                language: fields.language ?? 'en',
                segments: fields.segments,
                translations: fields.translations ?? null,
                status: fields.status ?? 'completed',
                // Preserve partial/complete translate status — don't wipe resume progress
                translateStatus: fields.translations
                    ? 'complete'
                    : (existing.translateStatus === 'partial' || existing.translateStatus === 'complete'
                        ? existing.translateStatus
                        : 'pending'),
                transcribedWith: fields.transcribedWith ?? 'whisper-medium',
                qcIssues: fields.qcIssues ?? null,
            },
        })
    }

    return prisma.filmSubtitle.create({
        data: {
            projectId,
            episodeId: episodeId ?? null,
            language: fields.language ?? 'en',
            segments: fields.segments,
            translations: fields.translations ?? null,
            status: fields.status ?? 'completed',
            translateStatus: fields.translations ? 'complete' : 'pending',
            transcribedWith: fields.transcribedWith ?? 'whisper-medium',
            qcIssues: fields.qcIssues ?? null,
        },
    })
}

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
        data: { translateStatus: 'partial', langStatus: toJson(updated) },
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
    await prisma.filmSubtitle.update({
        where: { id },
        data: {
            translations: translationsJson,
            langStatus: toJson(langStatus),
            vttPaths: toJson(vttPaths),
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
        data: { langStatus: toJson({ ...existingLangStatus, [lang]: 'failed' }) },
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
            langStatus: toJson(langStatus),
            vttPaths: toJson(vttPaths),
        },
    })
}

/**
 * Finalize a single-language retry.
 * Caller computes whether all languages are done and passes translateStatus directly
 * (ISP fix: repo no longer needs to know allTargetLangs/allTranslations).
 */
export async function finalizeSingleLang(
    id: string,
    lang: string,
    translationsJson: string,
    existingLangStatus: Record<string, string>,
    vttPaths: Record<string, string>,
    translateStatus: 'complete' | 'partial',
): Promise<void> {
    await prisma.filmSubtitle.update({
        where: { id },
        data: {
            translations: translationsJson,
            langStatus: toJson({ ...existingLangStatus, [lang]: 'completed' }),
            vttPaths: toJson(vttPaths),
            translateStatus,
        },
    })
}
