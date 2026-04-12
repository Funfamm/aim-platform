import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const body = await req.json()
        const applicationIds: string[] = body.applicationIds ?? []
        const { selectAllQuery, search, statusFilter, sort } = body

        let where: Record<string, unknown> = {}

        if (selectAllQuery) {
            if (search) {
                where.OR = [
                    { fullName: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                ]
            }
            if (statusFilter && statusFilter !== 'all') where.status = statusFilter
        } else {
            if (!applicationIds.length) return NextResponse.json({ error: 'No applications selected' }, { status: 400 })
            where = { id: { in: applicationIds } }
        }

        const CSV_ROW_CAP = 5000

        const apps = await prisma.application.findMany({
            where,
            orderBy: sort === 'oldest' ? { createdAt: 'asc' }
                : sort === 'score_high' ? { aiScore: 'desc' }
                : sort === 'score_low'  ? { aiScore: 'asc' }
                : { createdAt: 'desc' },
            take: CSV_ROW_CAP,
            select: {
                id: true,
                fullName: true,
                email: true,
                status: true,
                aiScore: true,
                aiFitLevel: true,
                createdAt: true,
                phone: true,
                age: true,
                gender: true,
                castingCall: {
                    select: {
                        roleName: true,
                        roleType: true,
                        project: { select: { title: true } },
                    },
                },
            },
        })
        const wasCapped = apps.length === CSV_ROW_CAP

        const rows = [
            'Name,Email,Phone,Age,Gender,Status,AI Score,AI Fit,Role,Project,Applied At',
            ...apps.map(app => [
                `"${app.fullName.replace(/"/g, '""')}"`,
                `"${app.email}"`,
                `"${app.phone ?? ''}"`,
                `"${app.age ?? ''}"`,
                `"${app.gender ?? ''}"`,
                `"${app.status}"`,
                app.aiScore != null ? Math.round(app.aiScore) : '',
                `"${app.aiFitLevel ?? ''}"`,
                `"${app.castingCall.roleName.replace(/"/g, '""')}"`,
                `"${app.castingCall.project.title.replace(/"/g, '""')}"`,
                `"${new Date(app.createdAt).toISOString().slice(0, 10)}"`,
            ].join(',')),
        ].join('\n')

        const filename = `AIM_Applications_${new Date().toISOString().slice(0, 10)}.csv`
        // UTF-8 BOM prefix ensures Excel opens non-ASCII characters correctly
        const bom = '\uFEFF'

        return new NextResponse(bom + rows, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'X-Row-Count': String(apps.length),
                'X-Row-Capped': wasCapped ? 'true' : 'false',
            },
        })
    } catch (error) {
        console.error('Export CSV error:', error)
        return NextResponse.json({ error: 'Export failed' }, { status: 500 })
    }
}
