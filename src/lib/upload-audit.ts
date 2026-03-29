/**
 * Upload Audit Logger
 * 
 * Logs all file upload events (accepts and rejects) for security monitoring.
 * Uses structured logging so events can be easily parsed by log aggregators.
 */

export type UploadEvent = {
    action: 'upload_accepted' | 'upload_rejected'
    route: string
    userId?: string | null
    ip?: string | null
    fileName: string
    mimeType: string
    fileSize: number
    reason?: string       // rejection reason
    code?: string         // machine-readable error code (e.g. MAGIC_BYTE_MISMATCH)
}

/**
 * Log an upload event to the server console in structured JSON format.
 * 
 * In production, these structured logs can be captured by services like
 * Render's log drain, Datadog, or CloudWatch for alerting.
 */
export function logUploadEvent(event: UploadEvent): void {
    const entry = {
        timestamp: new Date().toISOString(),
        level: event.action === 'upload_rejected' ? 'WARN' : 'INFO',
        ...event,
        // Sanitize the filename in the log to prevent log injection
        fileName: event.fileName
            .replace(/[\r\n\t]/g, '')        // strip control characters
            .replace(/[^\x20-\x7E]/g, '?')   // replace non-printable chars
            .slice(0, 200),                    // truncate
    }

    if (event.action === 'upload_rejected') {
        console.warn('[UPLOAD_SECURITY]', JSON.stringify(entry))
    } else {
        console.info('[UPLOAD_SECURITY]', JSON.stringify(entry))
    }
}
