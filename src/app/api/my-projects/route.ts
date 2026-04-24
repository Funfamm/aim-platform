import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionAndRefresh } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/my-projects
 *
 * Two access strategies:
 *   1. Token-based: ?id=PROJECT_ID&token=ACCESS_TOKEN (from email link)
 *   2. Auth-based:  logged-in user — returns all projects matching their email
 *
 * Token-based returns a single project; auth-based returns all projects.
 */
export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const token = url.searchParams.get('token')

    // ── Strategy 1: Token-based single-project access ───────────────────
    if (id && token) {
        const project = await prisma.projectRequest.findUnique({
            where: { id },
        })

        if (!project || project.accessToken !== token) {
            return NextResponse.json({ error: 'Invalid or expired link' }, { status: 403 })
        }

        return NextResponse.json({
            projects: [serializeProject(project)],
            strategy: 'token',
        })
    }

    // ── Strategy 2: Auth-based — all projects for the logged-in user ────
    const session = await getSessionAndRefresh()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
        where: { id: session.userId as string },
        select: { email: true },
    })

    if (!user?.email) {
        return NextResponse.json({ projects: [], strategy: 'auth' })
    }

    const projects = await prisma.projectRequest.findMany({
        where: { email: user.email.toLowerCase() },
        orderBy: { createdAt: 'desc' },
        take: 20,
    })

    return NextResponse.json({
        projects: projects.map(serializeProject),
        strategy: 'auth',
    })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeProject(p: any) {
    return {
        id: p.id,
        projectType: p.projectType,
        projectTitle: p.projectTitle,
        status: p.status,
        clientName: p.clientName,
        description: p.description,
        budgetRange: p.budgetRange,
        deadline: p.deadline?.toISOString() || null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
    }
}
