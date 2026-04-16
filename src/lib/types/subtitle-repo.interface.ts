/**
 * ISubtitleRepository — Contract interface for FilmSubtitle persistence.
 *
 * High-level modules (routes, services) should depend on this interface,
 * not on the concrete subtitle-repo.ts implementation (DIP).
 *
 * The concrete implementation lives in src/lib/subtitle-repo.ts.
 * Future implementations (e.g., in-memory for tests, alternate ORM) must
 * satisfy this contract.
 */

import type { UpsertSubtitleData, SubtitleSegment } from '@/lib/subtitle-repo'

/** Minimal subtitle record shape returned by repository reads. */
export interface SubtitleRecord {
    id: string
    projectId: string
    episodeId: string | null
    language: string
    segments: string
    translations: string | null
    status: string
    translateStatus: string
    langStatus: unknown
    vttPaths: unknown
    generatedWith: string | null
    transcribedWith: string | null
}

export interface ISubtitleRepository {
    /** Find the subtitle record for a project (and optional episode). Returns null if none exists. */
    findSubtitle(projectId: string, episodeId?: string | null): Promise<SubtitleRecord | null>

    /** Create or update a subtitle record (used after browser transcription). */
    upsertSubtitle(data: UpsertSubtitleData): Promise<SubtitleRecord>

    /**
     * Mark a set of languages as 'processing'.
     * Returns the merged langStatus map.
     */
    markLangsProcessing(
        id: string,
        langs: string[],
        existingLangStatus: Record<string, string>,
    ): Promise<Record<string, string>>

    /**
     * Checkpoint a successfully-translated language.
     * Persists translations + vttPaths + langStatus atomically.
     */
    checkpointLang(
        id: string,
        lang: string,
        translationsJson: string,
        langStatus: Record<string, string>,
        vttPaths: Record<string, string>,
        generatedWith?: string,
    ): Promise<void>

    /** Mark a single language as 'failed'. */
    failLang(
        id: string,
        lang: string,
        existingLangStatus: Record<string, string>,
    ): Promise<void>

    /**
     * Final update after all languages have been processed.
     * Sets translateStatus, status = 'completed', persists langStatus/vttPaths.
     */
    finalizeTranslation(
        id: string,
        translateStatus: 'complete' | 'partial',
        langStatus: Record<string, string>,
        vttPaths: Record<string, string>,
    ): Promise<void>

    /**
     * Finalize a single-language retry.
     * Caller computes translateStatus ('complete' | 'partial') before calling.
     */
    finalizeSingleLang(
        id: string,
        lang: string,
        translationsJson: string,
        existingLangStatus: Record<string, string>,
        vttPaths: Record<string, string>,
        translateStatus: 'complete' | 'partial',
    ): Promise<void>
}

// Re-export types so consumers only need to import from this file
export type { UpsertSubtitleData, SubtitleSegment }
