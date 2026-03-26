import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST() {
    try {
        const count = await prisma.heroVideo.count()
        if (count > 0) {
            return NextResponse.json({ message: `Already have ${count} hero videos` })
        }

        await prisma.heroVideo.createMany({
            data: [
                { title: 'Boxing Scene', url: '/videos/1.mp4', duration: 10, page: 'all', active: true, sortOrder: 1 },
                { title: 'Ring Action', url: '/videos/2.mp4', duration: 10, page: 'all', active: true, sortOrder: 2 },
                { title: 'Fight Clip', url: '/videos/3.mp4', duration: 10, page: 'all', active: true, sortOrder: 3 },
            ],
        })

        const total = await prisma.heroVideo.count()
        return NextResponse.json({ message: `Seeded ${total} hero videos!` })
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
