import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

// POST — receive client-side error reports
export async function POST(request: Request) {
    try {
        const { source, message, stack, componentStack } = await request.json()

        logger.error(source || 'client', message || 'Unknown client error', {
            meta: { stack, componentStack },
        })

        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 })
    }
}
