import { PrismaClient } from '@prisma/client'

/**
 * Centralised Prisma client — single source of truth for all DB access.
 *
 * Connection management:
 * - Uses the Neon pooler endpoint for connection multiplexing
 * - Configured with pool timeout and connection limit to handle
 *   Neon's idle connection reaping gracefully
 * - The `datasourceUrl` override appends pool settings if not present
 *
 * DIRECT_URL note:
 * - On Vercel (serverless), migrations never run, so DIRECT_URL is not required.
 * - We set it to DATABASE_URL as a fallback so Prisma's schema env() lookup never fails.
 * - On Render/CI, set DIRECT_URL explicitly for reliable migrations.
 */

// Ensure DIRECT_URL is always set so Prisma's schema env("DIRECT_URL") never throws.
// On Vercel the direct URL is optional — the pooler URL is used for all runtime queries.
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function buildDatasourceUrl(): string | undefined {
    const url = process.env.DATABASE_URL
    if (!url) return undefined
    // Append pool settings if not already present.
    // On Vercel serverless: connection_limit=1 because each function invocation
    // handles exactly one request — claiming 10 connections per invocation exhausts
    // the Neon pool when multiple functions run concurrently (confirmed cause of
    // "Timed out fetching a new connection" errors on the works page).
    const sep = url.includes('?') ? '&' : '?'
    const extras: string[] = []
    // 20s — Neon free/launch tier takes 10-15s to wake from cold start.
    // At 10s we were racing the wakeup and losing, causing 'Can\'t reach database server'.
    if (!url.includes('connect_timeout')) extras.push('connect_timeout=20')
    if (!url.includes('pool_timeout'))    extras.push('pool_timeout=20')
    if (!url.includes('connection_limit')) extras.push('connection_limit=1')
    return extras.length > 0 ? `${url}${sep}${extras.join('&')}` : url
}

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        datasourceUrl: buildDatasourceUrl(),
    })

// Always store in globalThis so warm serverless invocations reuse the client.
// The !== 'production' guard was wrong: it prevented caching in prod, forcing
// Prisma to re-run detect_platform (311-436ms) + load_engine on every warm request.
globalForPrisma.prisma = prisma

