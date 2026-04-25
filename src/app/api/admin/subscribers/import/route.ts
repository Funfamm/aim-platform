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

    // Disposable domain blocklist + typo correction (shared with subscribe route)
    const disposableDomains = new Set([
        'tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com',
        'yopmail.com', 'trashmail.com', 'fakeinbox.com', 'sharklasers.com',
        'guerrillamailblock.com', 'grr.la', 'dispostable.com', 'mailnesia.com',
        'tempail.com', 'temp-mail.org', 'mohmal.com', 'emailondeck.com',
        'getnada.com', '10minutemail.com', 'minutemail.com', 'maildrop.cc',
        'mailcatch.com', 'discard.email', 'tempr.email', 'temp-mail.io',
    ])
    const typoMap: Record<string, string> = {
        'gmial.com': 'gmail.com', 'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com',
        'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gmal.com': 'gmail.com',
        'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com',
        'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com',
        'hotmal.com': 'hotmail.com', 'hotmial.com': 'hotmail.com', 'hotmail.con': 'hotmail.com',
        'outloo.com': 'outlook.com', 'outlok.com': 'outlook.com',
        'iclou.com': 'icloud.com', 'icloud.con': 'icloud.com',
    }

    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim()
        if (!line) continue

        // Split by comma, handling quoted values
        const parts = line.match(/".*?"|[^,]+(?=,|$)/g)?.map(p => p.replace(/^"|"$/g, '').trim()) || []
        
        let email = (parts[0] || '').toLowerCase().trim()
        const name = (parts[1] || '').trim() || null

        if (!email || !emailRegex.test(email)) {
            results.skippedInvalid++
            if (results.errors.length < 20) {
                results.errors.push(`Row ${i + 1}: invalid email "${email}"`)
            }
            continue
        }

        // Auto-correct common domain typos
        const [localPart, domain] = email.split('@')
        if (domain && typoMap[domain]) {
            email = `${localPart}@${typoMap[domain]}`
        }

        // Block disposable domains
        const emailDomain = email.split('@')[1]
        if (emailDomain && disposableDomains.has(emailDomain)) {
            results.skippedInvalid++
            if (results.errors.length < 20) {
                results.errors.push(`Row ${i + 1}: disposable email domain blocked (${emailDomain})`)
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
