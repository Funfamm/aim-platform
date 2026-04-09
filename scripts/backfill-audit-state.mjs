/**
 * backfill-audit-state.mjs
 *
 * One-time script to set auditState on all existing Application rows.
 *
 * Rules:
 *   - aiScore IS NOT NULL           → scored_visible  (already scored, result can be shown)
 *   - aiScore IS NULL + submitted   → queued          (needs scoring if aiAutoAudit is on)
 *   - aiScore IS NULL + other status → null           (leave as-is, admin manually manages)
 *
 * Run once after deploying the new schema:
 *   node scripts/backfill-audit-state.mjs
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Starting audit state backfill...')

    // 1. Already scored — mark as visible
    const scoredResult = await prisma.application.updateMany({
        where: {
            aiScore: { not: null },
            auditState: null,
        },
        data: {
            auditState: 'scored_visible',
            adminRevealOverride: true, // treat all existing scored apps as visible
        },
    })
    console.log(`✓ Marked ${scoredResult.count} already-scored application(s) as scored_visible`)

    // 2. Not yet scored + submitted — queue them (requires aiAutoAudit=true to actually process)
    const queuedResult = await prisma.application.updateMany({
        where: {
            aiScore: null,
            auditState: null,
            status: 'submitted',
        },
        data: {
            auditState: 'queued',
            queuedAt: new Date(),
            priority: 0,
        },
    })
    console.log(`✓ Queued ${queuedResult.count} unscored submitted application(s)`)

    console.log('Backfill complete.')
}

main()
    .catch(err => { console.error('Backfill failed:', err); process.exit(1) })
    .finally(() => prisma.$disconnect())
