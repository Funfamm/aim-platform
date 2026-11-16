import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { normalizeRates } from '@/lib/client-brief/schema'

/** Save the rate card used to price client briefs. Body: { rates } */
export async function PUT(request: Request) {
    const session = await getUserSession()
    if (!session?.userId || (session.role !== 'admin' && session.role !== 'superadmin')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json().catch(() => ({}))
    const rates = normalizeRates(body.rates)
    await prisma.clientBriefConfig.upsert({
        where: { id: 'default' },
        create: { id: 'default', rates: rates as object },
        update: { rates: rates as object },
    })
    return NextResponse.json({ rates })
}
