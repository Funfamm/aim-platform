/**
 * Reset all pending survey_campaign emails so they're immediately eligible
 * for the email worker.
 * 
 * The previous failures set nextRunAt to future timestamps with exponential
 * backoff, so only a few become eligible each minute. This resets ALL of them
 * to NOW so the worker can drain them in bulk.
 * 
 * Run: node prisma/reset-survey-queue.mjs
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env manually
try {
  const env = readFileSync(join(__dirname, '../.env'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
  }
} catch {}

const prisma = new PrismaClient()

async function main() {
    // Count current state
    const pending = await prisma.emailQueue.count({
        where: { type: 'survey_campaign', status: 'pending' }
    })
    const failed = await prisma.emailQueue.count({
        where: { type: 'survey_campaign', status: 'failed' }
    })
    const processing = await prisma.emailQueue.count({
        where: { type: 'survey_campaign', status: 'processing' }
    })
    const sent = await prisma.emailQueue.count({
        where: { type: 'survey_campaign', status: 'sent' }
    })

    console.log('Survey campaign email queue state:')
    console.log(`  pending:    ${pending}`)
    console.log(`  failed:     ${failed}`)
    console.log(`  processing: ${processing}`)
    console.log(`  sent:       ${sent}`)
    console.log('')

    // Reset failed → pending with attempts=0 and nextRunAt=NOW
    const resetFailed = await prisma.emailQueue.updateMany({
        where: { type: 'survey_campaign', status: 'failed' },
        data: { status: 'pending', attempts: 0, nextRunAt: new Date(), error: null }
    })
    console.log(`Reset ${resetFailed.count} FAILED → pending`)

    // Reset pending jobs with future nextRunAt → NOW
    const resetPending = await prisma.emailQueue.updateMany({
        where: { type: 'survey_campaign', status: 'pending', nextRunAt: { gt: new Date() } },
        data: { nextRunAt: new Date() }
    })
    console.log(`Reset ${resetPending.count} PENDING jobs with future nextRunAt → NOW`)

    // Reset stuck processing → pending
    const resetProcessing = await prisma.emailQueue.updateMany({
        where: { type: 'survey_campaign', status: 'processing' },
        data: { status: 'pending', nextRunAt: new Date(), claimedAt: null }
    })
    console.log(`Reset ${resetProcessing.count} PROCESSING → pending`)

    // Final count
    const nowReady = await prisma.emailQueue.count({
        where: { type: 'survey_campaign', status: 'pending', nextRunAt: { lte: new Date() } }
    })
    console.log(`\n✅ ${nowReady} survey emails now immediately eligible for the worker`)
}

main()
    .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
    .finally(() => prisma.$disconnect())
