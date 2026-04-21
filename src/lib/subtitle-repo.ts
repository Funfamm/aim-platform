/**
 * subtitle-repo.ts — Repository layer for FilmSubtitle DB operations (SRP Fix).
 *
 * Single responsibility: pure CRUD against the FilmSubtitle table.
 * Contains ZERO business logic — no status-transition rules, no derive logic.
 *
 * All status-transition logic lives in subtitle-status-service.ts.
 * All Prisma Json casting uses the shared toJson from prisma-utils.ts (DRY fix).
 *
 * Dependency graph:
 *   SubtitleStatusService → updateSubtitleById (here)
 *   Routes               → findSubtitle, upsertSubtitle (here)
 */

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { toJson } from '@/lib/prisma-utils'

export type SubtitleSegment = { start: number; end: number; text: string }

/** Input shape for upsert (create or update). All business defaults are the caller's responsibility. */
export type UpsertSubtitleData = {
    projectId: string
    episodeId?: string | null
    language?: string
    /** ISO 639-1 code of the source video language detected by Whisper. */
    originalLanguage?: string
    segments: string
    translations?: string | null
    status?: string
    /** Must be computed by the caller (via subtitle-status-service). Defaults to 'pending'. */
    translateStatus?: string
    transcribedWith?: string
    qcIssues?: string | null
}

/** Input shape for a partial update (used exclusively by subtitle-status-service). */
export type SubtitleUpdateData = {
    translations?: string
    translateStatus?: string
    status?: string
    langStatus?: Prisma.InputJsonValue
    vttPaths?: Prisma.InputJsonValue
    generatedWith?: string
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
 *
 * PURE CRUD: this function writes exactly what it receives.
 * translateStatus business logic is owned by subtitle-status-service.ts.
 * Callers are responsible for passing a pre-computed translateStatus.
 */
export async function upsertSubtitle(data: UpsertSubtitleData) {
    const { projectId, episodeId, ...fields } = data
    const existing = await findSubtitle(projectId, episodeId)

    // Use the explicitly provided translateStatus — no derivation here.
    const translateStatus = fields.translateStatus ?? 'pending'

    if (existing) {
        return prisma.filmSubtitle.update({
            where: { id: existing.id },
            data: {
                language: fields.language ?? 'en',
                ...(fields.originalLanguage ? { originalLanguage: fields.originalLanguage } : {}),
                segments: fields.segments,
                translations: fields.translations ?? null,
                status: fields.status ?? 'completed',
                translateStatus,
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
            originalLanguage: fields.originalLanguage ?? fields.language ?? 'en',
            segments: fields.segments,
            translations: fields.translations ?? null,
            status: fields.status ?? 'completed',
            translateStatus,
            transcribedWith: fields.transcribedWith ?? 'whisper-medium',
            qcIssues: fields.qcIssues ?? null,
        },
    })
}

/**
 * Generic partial update for a subtitle record by its internal ID.
 * Used exclusively by subtitle-status-service.ts — routes must not call this directly.
 */
export async function updateSubtitleById(
    id: string,
    data: SubtitleUpdateData,
): Promise<void> {
    const payload: Prisma.FilmSubtitleUpdateInput = {}

    if (data.translations   !== undefined) payload.translations   = data.translations
    if (data.translateStatus !== undefined) payload.translateStatus = data.translateStatus
    if (data.status          !== undefined) payload.status          = data.status
    if (data.generatedWith   !== undefined) payload.generatedWith   = data.generatedWith
    if (data.langStatus      !== undefined) payload.langStatus      = toJson(data.langStatus as object)
    if (data.vttPaths        !== undefined) payload.vttPaths        = toJson(data.vttPaths as object)

    await prisma.filmSubtitle.update({ where: { id }, data: payload })
}
