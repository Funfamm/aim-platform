import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET(req: NextRequest) {
    // Admin preview: include unpublished courses
    let includeUnpublished = false
    if (req.nextUrl.searchParams.get('preview') === 'admin') {
        try { await requireAdmin(); includeUnpublished = true } catch { /* not admin */ }
    }

    const courses = await prisma.course.findMany({
        where: includeUnpublished ? {} : { published: true },
        orderBy: { sortOrder: 'asc' },
        include: {
            modules: {
                orderBy: { sortOrder: 'asc' },
                include: {
                    lessons: {
                        orderBy: { sortOrder: 'asc' },
                        select: { id: true, title: true, contentType: true, contentUrl: true, uploadPath: true, description: true, duration: true, sortOrder: true, translations: true },
                    },
                },
            },
            _count: { select: { enrollments: true } },
        },
    })

    return NextResponse.json(courses)
}
