/**
 * Error sanitization utilities.
 *
 * In production, error messages from exceptions may contain internal paths,
 * DB schema details, or library version info. These should never be exposed
 * to end users.
 */

/**
 * Returns a safe error message for API responses.
 * - In development: returns the actual error message for debugging
 * - In production: returns a generic message to prevent information leakage
 */
export function sanitizeError(error: unknown, fallback = 'An internal error occurred.'): string {
    if (process.env.NODE_ENV === 'development') {
        if (error instanceof Error) return error.message
        return String(error)
    }
    return fallback
}

/**
 * Builds a safe error response body for API routes.
 * Never includes stack traces in production.
 */
export function safeErrorResponse(error: unknown, publicMessage = 'An internal error occurred.') {
    if (process.env.NODE_ENV === 'development') {
        return {
            error: publicMessage,
            details: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        }
    }
    return { error: publicMessage }
}
