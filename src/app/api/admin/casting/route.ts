import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { translateAndSave } from '@/lib/translate'
import { notifyNewRole } from '@/lib/notifications'

export async function GET() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const castingCalls = await prisma.castingCall.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
            id: true, projectId: true, roleName: true, roleType: true,
            roleDescription: true, ageRange: true, gender: true, ethnicity: true,
            requirements: true, compensation: true, deadline: true, status: true,
            translations: true, createdAt: true,
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
        },
        'audition'
    )

    // Fire-and-forget: notify opted-in users about the new role
    if ((body.status || 'open') === 'open') {
        const projectTitle = castingCall.project?.title || 'AIM Studio'
        notifyNewRole(castingCall.id, body.roleName, projectTitle).catch(() => {})
    }

    return NextResponse.json(castingCall, { status: 201 })
}
