/**
 * subtitle-repo.ts — Repository layer for FilmSubtitle DB operations (SRP Fix).
 *
 * Single responsibility: pure CRUD against the FilmSubtitle table.
 * Status-transition logic (markLangsProcessing, checkpointLang, etc.) has been
 * moved to subtitle-status-service.ts so this file only reads from and writes
 * to Prisma — it contains zero business rules.
 *
 * Dependency graph:
 *   SubtitleStatusService → updateSubtitleById (here)
 *   Routes               → findSubtitle, upsertSubtitle (here)
 */

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

export type SubtitleSegment = { start: number; end: number; text: string }

/** Input shape for upsert (create or update) */
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

/** Input shape for a partial update (used by status-service) */
export type SubtitleUpdateData = {
    translations?: string
    translateStatus?: string
    status?: string
    langStatus?: Prisma.InputJsonValue
    vttPaths?: Prisma.InputJsonValue
    generatedWith?: string
}

// ── Internal helper ───────────────────────────────────────────────────────────

/**
 * Cast a plain Record to Prisma.InputJsonValue so Json? fields accept it.
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
 * Used by POST /api/admin/subtitles after transcription completes.
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
 * Generic partial update for a subtitle record by its internal ID.
 * Used exclusively by subtitle-status-service.ts — routes should not call this directly.
 *
 * Keeping this as a thin wrapper around prisma.update ensures the repo
 * remains the sole Prisma access point (DIP boundary for DB).
 */
export async function updateSubtitleById(
    id: string,
    data: SubtitleUpdateData,
): Promise<void> {
    // Build a clean update payload — exclude undefined fields so Prisma
    // doesn't attempt to nullify optional columns unintentionally.
    const payload: Prisma.FilmSubtitleUpdateInput = {}

    if (data.translations   !== undefined) payload.translations   = data.translations
    if (data.translateStatus !== undefined) payload.translateStatus = data.translateStatus
    if (data.status          !== undefined) payload.status          = data.status
    if (data.generatedWith   !== undefined) payload.generatedWith   = data.generatedWith
    if (data.langStatus      !== undefined) payload.langStatus      = toJson(data.langStatus as object)
    if (data.vttPaths        !== undefined) payload.vttPaths        = toJson(data.vttPaths as object)

    await prisma.filmSubtitle.update({ where: { id }, data: payload })
}
