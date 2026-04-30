import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'

function isAdmin(role: string) {
    return role === 'admin' || role === 'superadmin'
}

export async function GET(req: Request) {
    const session = await getUserSession()
    if (!session?.userId || !isAdmin(session.role)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const url = new URL(req.url)
        const filter = url.searchParams.get('filter') || 'all'

        const survey = await prisma.survey.findFirst({
            where: { active: true },
            orderBy: { createdAt: 'desc' },
        })

        if (!survey) {
            return new Response('No active survey found', { status: 404 })
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: Record<string, any> = { surveyId: survey.id }
        if (filter === 'flagged') where.flagged = true
        if (filter === 'converted') where.converted = true

        const responses = await prisma.surveyResponse.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        })

        const header = 'timestamp,email,selections,freeText,country,locale,converted,flagged'
        const rows = responses.map(r => {
            const ts = r.createdAt.toISOString()
            const email = r.email || ''
            const selections = r.selections.join(';')
            const freeText = (r.freeText || '').replace(/"/g, '""')
            const country = r.country || ''
            const locale = r.locale
            const converted = r.converted ? 'true' : 'false'
            const flagged = r.flagged ? 'true' : 'false'
            return `${ts},"${email}","${selections}","${freeText}","${country}","${locale}",${converted},${flagged}`
        })

        const csv = [header, ...rows].join('\n')
        const filterLabel = filter !== 'all' ? `-${filter}` : ''

        return new Response(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="survey-responses${filterLabel}-${new Date().toISOString().slice(0, 10)}.csv"`,
            },
        })
    } catch (error) {
        console.error('[Admin Survey Export] Error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
