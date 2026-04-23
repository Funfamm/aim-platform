import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

const MAX_ROWS = 5000
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2 MB

/**
 * POST /api/admin/subscribers/import
 * Import subscribers from CSV. Expects: email (required), name (optional).
 * Body: { csv: string } — raw CSV content.
 * 
 * Validates emails, deduplicates, and upserts with source="admin_csv_import".
 * Returns detailed import summary.
 */
export async function POST(req: Request) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const csv: string = body.csv

    if (!csv || typeof csv !== 'string') {
        return NextResponse.json({ error: 'csv field is required (raw CSV string)' }, { status: 400 })
    }

    if (csv.length > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File too large — max ${MAX_FILE_SIZE / 1024 / 1024}MB` }, { status: 400 })
    }

    // Parse CSV
    const lines = csv.split(/\r?\n/).filter(line => line.trim())
    if (lines.length === 0) {
        return NextResponse.json({ error: 'CSV is empty' }, { status: 400 })
    }

    // Detect header row
    const firstLine = lines[0].toLowerCase()
    const hasHeader = firstLine.includes('email') || firstLine.includes('name')
    const dataLines = hasHeader ? lines.slice(1) : lines

    if (dataLines.length > MAX_ROWS) {
        return NextResponse.json({ error: `Too many rows — max ${MAX_ROWS}` }, { status: 400 })
    }

    // Parse rows
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const results = {
        total: dataLines.length,
        imported: 0,
        skippedDuplicate: 0,
        skippedInvalid: 0,
        errors: [] as string[],
    }

    const seen = new Set<string>()
    const validRows: { email: string; name: string | null }[] = []

    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim()
        if (!line) continue

        // Split by comma, handling quoted values
        const parts = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map(p => p.replace(/^"|"$/g, '').trim()) || []
        
        const email = (parts[0] || '').toLowerCase().trim()
        const name = (parts[1] || '').trim() || null

        if (!email || !emailRegex.test(email)) {
            results.skippedInvalid++
            if (results.errors.length < 20) {
                results.errors.push(`Row ${i + 1}: invalid email "${email}"`)
            }
            continue
        }

        if (seen.has(email)) {
            results.skippedDuplicate++
            continue
        }
        seen.add(email)
        validRows.push({ email, name })
    }

    // Batch upsert
    const BATCH = 50
    for (let i = 0; i < validRows.length; i += BATCH) {
        const batch = validRows.slice(i, i + BATCH)
        await Promise.allSettled(batch.map(async (row) => {
            try {
                await prisma.subscriber.upsert({
                    where: { email: row.email },
                    update: {
                        name: row.name || undefined,
                        active: true,
                        source: 'admin_csv_import',
                    },
                    create: {
                        email: row.email,
                        name: row.name,
                        active: true,
                        source: 'admin_csv_import',
                        confirmedAt: new Date(), // CSV imports are pre-confirmed
                    },
                })
                results.imported++
            } catch {
                results.skippedDuplicate++
            }
        }))
    }

    return NextResponse.json({
        success: true,
        ...results,
    })
}
