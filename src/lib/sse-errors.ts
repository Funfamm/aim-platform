/**
 * sse-errors.ts — Shared SSE numeric error codes.
 *
 * Import in every SSE route instead of defining a local ERR object
 * so that clients can switch on a single set of constants.
 *
 * Codes follow HTTP status semantics where possible.
 */

export const SSE_ERR = {
    /** 404 — No DB record found for the given project/episode */
    NOT_FOUND: 404,
    /** 409 — A translation job is already running (rate-limit guard) */
    RATE_LIMITED: 409,
    /** 500 — Failed to JSON-parse the stored subtitle segments */
    PARSE_FAILED: 500,
    /** 502 — Gemini translation call failed */
    TRANSLATE_FAILED: 502,
} as const

export type SseErrCode = typeof SSE_ERR[keyof typeof SSE_ERR]
