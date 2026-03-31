import { PrismaClient } from '@prisma/client'

/**
 * Centralised Prisma client — single source of truth for all DB access.
 *
 * Connection management:
 * - Uses the Neon pooler endpoint for connection multiplexing
 * - Configured with pool timeout and connection limit to handle
 *   Neon's idle connection reaping gracefully
 * - The `datasourceUrl` override appends pool settings if not present
 */

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function buildDatasourceUrl(): string | undefined {
    const url = process.env.DATABASE_URL
    if (!url) return undefined
    // Append pool settings if not already present
    const sep = url.includes('?') ? '&' : '?'
    const extras: string[] = []
    if (!url.includes('connect_timeout')) extras.push('connect_timeout=15')
    if (!url.includes('pool_timeout'))    extras.push('pool_timeout=15')
    if (!url.includes('connection_limit')) extras.push('connection_limit=10')
    return extras.length > 0 ? `${url}${sep}${extras.join('&')}` : url
}

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        datasourceUrl: buildDatasourceUrl(),
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

