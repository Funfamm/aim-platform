import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { translateAndSave } from '@/lib/translate'

export async function GET() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const castingCalls = await prisma.castingCall.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        include: {
            project: { select: { id: true, title: true, slug: true, genre: true, year: true, coverImage: true } },
            _count: { select: { applications: true } },
        },
    })

    return NextResponse.json(castingCalls)
}

export async function POST(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const body = await req.json()

    if (!body.projectId || !body.roleName || !body.roleDescription || !body.requirements) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const castingCall = await prisma.castingCall.create({
        data: {
            projectId: body.projectId,
            roleName: body.roleName,
            roleType: body.roleType || 'lead',
            roleDescription: body.roleDescription,
            ageRange: body.ageRange || null,
            gender: body.gender || null,
            ethnicity: body.ethnicity || null,
            requirements: body.requirements,
            compensation: body.compensation || null,
            deadline: body.deadline || null,
            status: body.status || 'open',
        },
        include: {
            project: { select: { id: true, title: true, slug: true, genre: true, year: true, coverImage: true } },
            _count: { select: { applications: true } },
        },
    })

    // Fire-and-forget: translate content in background
    translateAndSave(
        { roleName: body.roleName, roleDescription: body.roleDescription },
        async (translations) => {
            await prisma.castingCall.update({ where: { id: castingCall.id }, data: { translations } })
        }
    )

    return NextResponse.json(castingCall, { status: 201 })
}
