import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

// ── Copy templates ──────────────────────────────────────────────────────────
const TEMPLATES = {
    release: {
        eyebrow: 'COMING SOON',
        headlineRegular: '[Film Name]',
        headlineItalic: 'is on its way.',
        subtext: 'Be the first to watch when it drops.',
        buttonLabel: '🔔 Notify Me',
        footnote: 'No spam. Just the moment it releases.',
    },
    more: {
        eyebrow: 'THE STORY CONTINUES',
        headlineRegular: 'Some stories',
        headlineItalic: "don't end.",
        subtext: "[Film Name] isn't finished. Be the first to know when the next chapter arrives.",
        buttonLabel: '🔔 Notify Me',
        footnote: 'No spam. Just the moment it drops.',
    },
} as const

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')
}

// ── GET: List all CTA configurations ────────────────────────────────────────
export async function GET(req: NextRequest) {
    let admin: { userId: string; email?: string }
    try { admin = await requireAdmin() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const statusFilter = searchParams.get('status') || 'all'
    const sort = searchParams.get('sort') || 'newest'

    const where = statusFilter !== 'all' ? { status: statusFilter } : {}

    const ctas = await prisma.ctaConfiguration.findMany({
        where,
        orderBy: sort === 'oldest' ? { createdAt: 'asc' } : { createdAt: 'desc' },
    })

    // Fetch associated project info and signup counts
    const videoIds = [...new Set(ctas.map(c => c.videoId))]
    const [projects, signupCounts, recentSignupCounts] = await Promise.all([
        prisma.project.findMany({
            where: { id: { in: videoIds } },
            select: { id: true, title: true, slug: true, status: true, coverImage: true },
        }),
        // Total signups per tag
        prisma.notificationSignup.groupBy({
            by: ['signupTag'],
            where: { signupTag: { in: ctas.map(c => c.signupTag) } },
            _count: true,
        }),
        // Signups in last 7 days per tag
        prisma.notificationSignup.groupBy({
            by: ['signupTag'],
            where: {
                signupTag: { in: ctas.map(c => c.signupTag) },
                createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
            _count: true,
        }),
    ])

    const projectMap = new Map(projects.map(p => [p.id, p]))
    const countMap = new Map(signupCounts.map(s => [s.signupTag, s._count]))
    const recentMap = new Map(recentSignupCounts.map(s => [s.signupTag, s._count]))

    const enriched = ctas.map(cta => ({
        ...cta,
        project: projectMap.get(cta.videoId) || null,
        signupCount: countMap.get(cta.signupTag) || 0,
        signupsLast7Days: recentMap.get(cta.signupTag) || 0,
    }))

    return NextResponse.json({ ctas: enriched })
}

// ── POST: Create a new CTA configuration ────────────────────────────────────
export async function POST(req: NextRequest) {
    let admin: { userId: string; email?: string }
    try { admin = await requireAdmin() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { videoId, notificationType, ...copyOverrides } = body

        if (!videoId || !notificationType) {
            return NextResponse.json({ error: 'videoId and notificationType are required' }, { status: 400 })
        }
        if (!['release', 'more'].includes(notificationType)) {
            return NextResponse.json({ error: 'notificationType must be "release" or "more"' }, { status: 400 })
        }

        // Check project exists
        const project = await prisma.project.findUnique({
            where: { id: videoId },
            select: { id: true, slug: true, title: true },
        })
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }

        // Check no other active CTA on this video
        const existing = await prisma.ctaConfiguration.findFirst({
            where: { videoId, status: 'active' },
        })
        if (existing) {
            return NextResponse.json(
                { error: 'This video already has an active CTA. Disable it first.' },
                { status: 409 }
            )
        }

        // Generate signup tag
        const signupTag = `${slugify(project.slug)}_${notificationType}`

        // Check if this tag already exists (re-enabling same type)
        const existingTag = await prisma.ctaConfiguration.findUnique({
            where: { signupTag },
        })
        if (existingTag) {
            // Re-enable the existing CTA (preserves old signups)
            const updated = await prisma.ctaConfiguration.update({
                where: { id: existingTag.id },
                data: {
                    status: 'active',
                    ...(Object.keys(copyOverrides).length > 0 ? copyOverrides : {}),
                    updatedAt: new Date(),
                },
            })
            return NextResponse.json({ cta: updated, reactivated: true })
        }

        // Build copy from template + overrides
        const template = TEMPLATES[notificationType as keyof typeof TEMPLATES]
        const cta = await prisma.ctaConfiguration.create({
            data: {
                videoId,
                notificationType,
                signupTag,
                status: 'active',
                eyebrow: copyOverrides.eyebrow || template.eyebrow,
                headlineRegular: copyOverrides.headlineRegular || template.headlineRegular,
                headlineItalic: copyOverrides.headlineItalic || template.headlineItalic,
                subtext: copyOverrides.subtext || template.subtext,
                buttonLabel: copyOverrides.buttonLabel || template.buttonLabel,
                footnote: copyOverrides.footnote || template.footnote,
                // Modal & confirmation use Prisma defaults unless overridden
                ...(copyOverrides.modalHeadline ? { modalHeadline: copyOverrides.modalHeadline } : {}),
                ...(copyOverrides.modalSubtext ? { modalSubtext: copyOverrides.modalSubtext } : {}),
                ...(copyOverrides.modalButtonLabel ? { modalButtonLabel: copyOverrides.modalButtonLabel } : {}),
                ...(copyOverrides.triggerSecondsFromEnd ? { triggerSecondsFromEnd: copyOverrides.triggerSecondsFromEnd } : {}),
                createdBy: admin.userId,
            },
        })

        return NextResponse.json({ cta }, { status: 201 })
    } catch (error) {
        console.error('[admin/cta-configurations] POST error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// ── PATCH: Update a CTA configuration ───────────────────────────────────────
export async function PATCH(req: NextRequest) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { id, ...updates } = body

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        // Validate status transitions
        if (updates.status && !['active', 'disabled', 'auto_disabled_post_release'].includes(updates.status)) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
        }

        // If re-activating, check no other active CTA on the same video
        if (updates.status === 'active') {
            const cta = await prisma.ctaConfiguration.findUnique({ where: { id } })
            if (cta) {
                const conflict = await prisma.ctaConfiguration.findFirst({
                    where: { videoId: cta.videoId, status: 'active', id: { not: id } },
                })
                if (conflict) {
                    return NextResponse.json(
                        { error: 'Another CTA is already active on this video. Disable it first.' },
                        { status: 409 }
                    )
                }
            }
        }

        // Strip fields that shouldn't be updated directly
        delete updates.signupTag
        delete updates.videoId
        delete updates.notificationType

        const updated = await prisma.ctaConfiguration.update({
            where: { id },
            data: updates,
        })

        return NextResponse.json({ cta: updated })
    } catch (error) {
        console.error('[admin/cta-configurations] PATCH error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

// ── DELETE: Soft-delete (disable) a CTA ─────────────────────────────────────
export async function DELETE(req: NextRequest) {
    try { await requireAdmin() } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { id } = body

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 })
        }

        const updated = await prisma.ctaConfiguration.update({
            where: { id },
            data: { status: 'disabled' },
        })

        return NextResponse.json({ cta: updated, message: 'CTA disabled. Signup history preserved.' })
    } catch (error) {
        console.error('[admin/cta-configurations] DELETE error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
