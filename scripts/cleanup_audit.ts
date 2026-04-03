/**
 * scripts/cleanup_audit.ts
 * ---------------------------------------------------------------------------
 * Deletes PreferenceAudit records older than 90 days.
 * Run as a scheduled job (cron) — e.g. daily via Render Cron Jobs.
 *
 * Usage:
 *   npx ts-node --esm scripts/cleanup_audit.ts
 *   # or add to package.json: "scripts": { "cleanup:audit": "..." }
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const RETENTION_DAYS = 90

async function main() {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (prisma as any).preferenceAudit.deleteMany({
        where: { timestamp: { lt: cutoff } },
    })

    console.log(`[cleanup_audit] Deleted ${result.count} audit records older than ${RETENTION_DAYS} days (before ${cutoff.toISOString()})`)
}

main()
    .catch((err) => {
        console.error('[cleanup_audit] Error:', err)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
