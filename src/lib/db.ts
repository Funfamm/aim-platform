import { PrismaClient } from '@prisma/client'

/**
 * Centralised Prisma client — single source of truth for all DB access.
 * Uses the DATABASE_URL from .env (defaults to SQLite via better-sqlite3).
 *
 * To switch to PostgreSQL:
 * 1. Set DATABASE_PROVIDER=postgresql in .env
 * 2. Set DATABASE_URL=postgresql://user:pass@host:5432/aim_db
 * 3. Update prisma/schema.prisma: provider = "postgresql"
 * 4. Run: npx prisma migrate dev
 */

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
