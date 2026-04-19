/**
 * scripts/recover-subtitle-job.mjs
 *
 * One-shot recovery: mark the stuck subtitle job as ready and
 * persist its transcript segments by downloading and parsing the VTT from R2.
 *
 * Usage: node scripts/recover-subtitle-job.mjs
 */

import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

// Load .env manually
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env')
const envLines = readFileSync(envPath, 'utf8').split('\n')
for (const line of envLines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
    }
    process.env[key] = val
}

// ── Config — edit these if re-running for a different job ────────────────────
const JOB_ID    = 'cmo5dp9gf0000ie04h7bfvlb6'
const PROJECT_ID = 'cmnbbineq001ckm29i6tubnyb'
const VTT_URL   = 'https://pub-2077aa6783e3436789dd10f34a2a2829.r2.dev/subtitles/cmnbbineq001ckm29i6tubnyb/cmo5dp9gf0000ie04h7bfvlb6-1776579744.vtt'
const SRT_URL   = VTT_URL.replace('.vtt', '.srt')
const LANGUAGE  = 'en'

// ── Parse WebVTT cues ────────────────────────────────────────────────────────
function parseVtt(text) {
    const blocks = text.split(/\n{2,}/)
    const segments = []
    for (const block of blocks) {
        const lines = block.trim().split('\n')
        const timeLine = lines.find(l => l.includes(' --> '))
        if (!timeLine) continue
        const [startStr, endStr] = timeLine.split(' --> ')
        const parseTime = t => {
            const clean = t.trim().replace(',', '.')
            const parts = clean.split(':').map(Number)
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
            if (parts.length === 2) return parts[0] * 60 + parts[1]
            return 0
        }
        const text = lines
            .filter(l => !l.includes(' --> ') && !/^\d+$/.test(l.trim()) && l.trim() !== 'WEBVTT')
            .join(' ').trim()
        if (text) segments.push({ start: parseTime(startStr), end: parseTime(endStr), text })
    }
    return segments
}

// ── Main ─────────────────────────────────────────────────────────────────────
const require = createRequire(import.meta.url)
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log(`\n🔧 Recovery for job: ${JOB_ID}`)

    // 1. Check job exists
    const job = await prisma.subtitleJob.findUnique({ where: { id: JOB_ID } })
    if (!job) {
        console.error(`❌ Job ${JOB_ID} not found in database`)
        process.exit(1)
    }
    console.log(`   Current status: ${job.status}`)

    // 2. Download VTT and parse segments
    console.log(`   Downloading VTT: ${VTT_URL}`)
    const res = await fetch(VTT_URL)
    if (!res.ok) {
        console.error(`❌ VTT fetch failed: HTTP ${res.status}`)
        process.exit(1)
    }
    const vttText = await res.text()
    const segments = parseVtt(vttText)
    console.log(`   Parsed ${segments.length} segments from VTT`)

    // 3. Mark job ready
    await prisma.subtitleJob.update({
        where: { id: JOB_ID },
        data: { status: 'ready', vttUrl: VTT_URL, srtUrl: SRT_URL, errorMessage: null },
    })
    console.log(`   ✅ SubtitleJob marked ready`)

    // 4. Upsert FilmSubtitle record
    const existing = await prisma.filmSubtitle.findFirst({
        where: { projectId: PROJECT_ID, language: LANGUAGE },
    })
    if (existing) {
        await prisma.filmSubtitle.update({
            where: { id: existing.id },
            data: {
                segments: JSON.stringify(segments),
                status: 'completed',
                transcribedWith: 'faster-whisper',
                translateStatus: 'pending',
            },
        })
        console.log(`   ✅ Updated existing FilmSubtitle record (${existing.id})`)
    } else {
        await prisma.filmSubtitle.create({
            data: {
                projectId: PROJECT_ID,
                episodeId: null,
                language: LANGUAGE,
                segments: JSON.stringify(segments),
                status: 'completed',
                transcribedWith: 'faster-whisper',
                translateStatus: 'pending',
            },
        })
        console.log(`   ✅ Created new FilmSubtitle record`)
    }

    console.log(`\n🎉 Recovery complete! ${segments.length} segments saved.`)
    console.log(`   VTT: ${VTT_URL}`)
    console.log(`   SRT: ${SRT_URL}`)
    console.log(`\n   → Go to Admin → Projects → Review to see the transcript.`)
    console.log(`   → Click "Generate Subtitles (CC)" to run translation.\n`)
}

main()
    .catch(e => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())
