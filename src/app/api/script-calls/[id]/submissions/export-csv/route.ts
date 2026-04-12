import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

async function isAdmin() {
    const session = await getSession()
    return session?.role === 'admin' || session?.role === 'superadmin'
}

/**
 * POST /api/script-calls/[id]/submissions/export-csv
 * Exports selected (or all) submissions for a script call as CSV.
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id: scriptCallId } = await params

    try {
        const body = await req.json()
        const submissionIds: string[] = body.submissionIds ?? []

        const where = submissionIds.length > 0
            ? { id: { in: submissionIds }, scriptCallId }
            : { scriptCallId }

        const CSV_ROW_CAP = 5000

        const submissions = await prisma.scriptSubmission.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: CSV_ROW_CAP,
            include: { analysis: true },
        })
        const wasCapped = submissions.length === CSV_ROW_CAP

        const rows = [
            'Title,Author,Email,Status,AI Score,Genre,Duration,Submitted At,Recommendation',
            ...submissions.map(sub => [
                `"${sub.title.replace(/"/g, '""')}"`,
                `"${sub.authorName.replace(/"/g, '""')}"`,
                `"${sub.authorEmail}"`,
                `"${sub.status}"`,
                sub.analysis?.overallScore != null ? Math.round(sub.analysis.overallScore) : '',
                `"${sub.genre ?? ''}"`,
                `"${sub.estimatedDuration ?? ''}"`,
                `"${new Date(sub.createdAt).toISOString().slice(0, 10)}"`,
                `"${(sub.analysis?.recommendation ?? '').replace(/"/g, '""')}"`,
            ].join(',')),
        ].join('\n')

        const filename = `AIM_ScriptSubmissions_${new Date().toISOString().slice(0, 10)}.csv`
        const bom = '\uFEFF'

        return new NextResponse(bom + rows, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'X-Row-Count': String(submissions.length),
                'X-Row-Capped': wasCapped ? 'true' : 'false',
            },
        })
    } catch (error) {
        console.error('Script export CSV error:', error)
        return NextResponse.json({ error: 'Export failed' }, { status: 500 })
    }
}
