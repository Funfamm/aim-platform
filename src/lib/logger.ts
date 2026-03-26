/**
 * Structured Error Logger
 *
 * File-based error logging with structured JSON output.
 * No Sentry required — errors are written to a local log file
 * and queryable via the admin API.
 *
 * In production, swap this for a real service (Sentry, LogRocket, etc.)
 */

import fs from 'fs'
import path from 'path'

export interface LogEntry {
    id: string
    timestamp: string
    level: 'error' | 'warn' | 'info'
    source: string              // e.g. "api/auth/login", "component/Dashboard"
    message: string
    stack?: string
    meta?: Record<string, unknown>
    userId?: string
    ip?: string
}

const LOG_DIR = path.join(process.cwd(), 'logs')
const MAX_ENTRIES = 500       // Keep last 500 entries in memory
const MAX_FILE_SIZE = 5_000_000 // 5MB max log file

// In-memory ring buffer of recent errors
let recentErrors: LogEntry[] = []

function ensureLogDir() {
    try {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true })
        }
    } catch {
        // Can't create log dir — continue without file logging
    }
}

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getLogFile(): string {
    const date = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    return path.join(LOG_DIR, `errors-${date}.jsonl`)
}

function writeToFile(entry: LogEntry) {
    try {
        ensureLogDir()
        const logFile = getLogFile()

        // Check file size — rotate if too large
        try {
            const stats = fs.statSync(logFile)
            if (stats.size > MAX_FILE_SIZE) {
                const archive = logFile.replace('.jsonl', `-${Date.now()}.jsonl`)
                fs.renameSync(logFile, archive)
            }
        } catch {
            // File doesn't exist yet — that's fine
        }

        fs.appendFileSync(logFile, JSON.stringify(entry) + '\n')
    } catch {
        // Silent fail — logging should never crash the app
    }
}

export const logger = {
    error(source: string, message: string, opts?: { error?: unknown; meta?: Record<string, unknown>; userId?: string; ip?: string }) {
        const entry: LogEntry = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            level: 'error',
            source,
            message,
            stack: opts?.error instanceof Error ? opts.error.stack : undefined,
            meta: opts?.meta,
            userId: opts?.userId,
            ip: opts?.ip,
        }

        // Console output (always)
        console.error(`[ERROR] ${source}: ${message}`, opts?.error || '')

        // In-memory buffer
        recentErrors.push(entry)
        if (recentErrors.length > MAX_ENTRIES) {
            recentErrors = recentErrors.slice(-MAX_ENTRIES)
        }

        // File output
        writeToFile(entry)

        return entry
    },

    warn(source: string, message: string, meta?: Record<string, unknown>) {
        const entry: LogEntry = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            level: 'warn',
            source,
            message,
            meta,
        }

        console.warn(`[WARN] ${source}: ${message}`)
        recentErrors.push(entry)
        if (recentErrors.length > MAX_ENTRIES) {
            recentErrors = recentErrors.slice(-MAX_ENTRIES)
        }
        writeToFile(entry)

        return entry
    },

    info(source: string, message: string, meta?: Record<string, unknown>) {
        const entry: LogEntry = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            level: 'info',
            source,
            message,
            meta,
        }

        console.log(`[INFO] ${source}: ${message}`)
        // Only write to file, don't clutter in-memory buffer with info logs
        writeToFile(entry)

        return entry
    },

    /** Get recent errors from the in-memory buffer */
    getRecent(limit = 50, level?: 'error' | 'warn' | 'info'): LogEntry[] {
        let entries = recentErrors
        if (level) {
            entries = entries.filter(e => e.level === level)
        }
        return entries.slice(-limit).reverse() // newest first
    },

    /** Get the count of errors/warnings in the last N minutes */
    getStats(minutes = 60) {
        const cutoff = Date.now() - minutes * 60_000
        const recent = recentErrors.filter(e => new Date(e.timestamp).getTime() > cutoff)
        return {
            errors: recent.filter(e => e.level === 'error').length,
            warnings: recent.filter(e => e.level === 'warn').length,
            total: recent.length,
        }
    },
}
