/**
 * scripts/rotate_tokens.ts
 * ---------------------------------------------------------------------------
 * Daily token rotation script.
 * Increments tokenVersion for all users whose last login was more than
 * 30 days ago, effectively invalidating stale tokens.
 *
 * Run as a Render Cron Job (daily):
 *   Command: npx ts-node --esm scripts/rotate_tokens.ts
 *
 * For emergency rotation of ALL users, use the admin endpoint instead:
 *   POST /api/auth/rotate  (superadmin only)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const STALE_DAYS = 30

async function main() {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - STALE_DAYS)

    // Rotate users who haven't logged in recently (stale sessions)
    const result = await prisma.user.updateMany({
        where: {
            lastLoginAt: { lt: cutoff },
        },
        data: { tokenVersion: { increment: 1 } },
    })

    console.log(`[rotate_tokens] Rotated tokens for ${result.count} users with last login before ${cutoff.toISOString()}`)
}

main()
    .catch((err) => {
        console.error('[rotate_tokens] Error:', err)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
