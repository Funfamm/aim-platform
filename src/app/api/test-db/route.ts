import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
    try {
        const count = await prisma.project.count()
        return NextResponse.json({
            success: true,
            projectCount: count,
            message: 'Database connected successfully!'
        })
    } catch (error: unknown) {
        const err = error as Error
        return NextResponse.json({
            error: err.message,
            name: err.name,
        }, { status: 500 })
    }
}
