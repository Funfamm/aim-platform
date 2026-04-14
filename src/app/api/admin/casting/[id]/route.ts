import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { translateAndSave } from '@/lib/translate'

// Validates that a URL is http/https only — rejects javascript:, data:, etc.
function isSafeUrl(url: string | undefined): boolean {
    if (!url) return true
    try { return /^https?:\/\//i.test(url) } catch { return false }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params
    const body = await req.json()

    if (body.bannerUrl !== undefined && !isSafeUrl(body.bannerUrl)) {
        return NextResponse.json({ error: 'Invalid bannerUrl' }, { status: 400 })
    }

    const castingCall = await prisma.castingCall.update({
        where: { id },
        data: {
            ...(body.projectId !== undefined && { projectId: body.projectId }),
            ...(body.roleName !== undefined && { roleName: body.roleName }),
            ...(body.roleType !== undefined && { roleType: body.roleType }),
            ...(body.roleDescription !== undefined && { roleDescription: body.roleDescription }),
            ...(body.ageRange !== undefined && { ageRange: body.ageRange || null }),
            ...(body.gender !== undefined && { gender: body.gender || null }),
            ...(body.ethnicity !== undefined && { ethnicity: body.ethnicity || null }),
            ...(body.requirements !== undefined && { requirements: body.requirements }),
            ...(body.compensation !== undefined && { compensation: body.compensation || null }),
            ...(body.deadline !== undefined && { deadline: body.deadline || null }),
            ...(body.status !== undefined && { status: body.status }),
            ...(body.bannerUrl !== undefined && { bannerUrl: body.bannerUrl || null }),
        },
        include: {
            project: { select: { id: true, title: true, slug: true, genre: true, year: true, coverImage: true } },
            _count: { select: { applications: true } },
        },
    })

    // Re-translate if text content changed
    if (body.roleName !== undefined || body.roleDescription !== undefined) {
        translateAndSave(
            { roleName: castingCall.roleName, roleDescription: castingCall.roleDescription },
            async (translations) => {
                await prisma.castingCall.update({ where: { id }, data: { translations } as any })
            },
            'audition'
        )
    }

    return NextResponse.json(castingCall)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id } = await params

    try {
        // Soft delete: mark as 'deleted' instead of destroying the record.
        // This preserves all application data and lets applicants see a "Role Closed" banner
        // instead of a 404. Hard-delete is intentionally avoided because the Application
        // relation uses onDelete: Cascade — destroying a CastingCall destroys all applications.
        await prisma.castingCall.update({
            where: { id },
            data: { status: 'deleted', updatedAt: new Date() },
        })
        return NextResponse.json({ success: true })
    } catch (err: unknown) {
        // P2025 = record not found — return clean 404 instead of silent 500
        if ((err as { code?: string })?.code === 'P2025') {
            return NextResponse.json({ error: 'Casting call not found' }, { status: 404 })
        }
        return NextResponse.json({ error: 'Failed to delete casting call' }, { status: 500 })
    }
}
