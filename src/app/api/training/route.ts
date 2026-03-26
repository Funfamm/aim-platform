import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
    const courses = await prisma.course.findMany({
        where: { published: true },
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
