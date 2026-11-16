import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { makeToken, normalizeRates } from '@/lib/client-brief/schema'

async function requireAdmin() {
    const session = await getUserSession()
    return !!session?.userId && (session.role === 'admin' || session.role === 'superadmin')
}

/** List every client brief plus the current rate card. */
export async function GET() {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const [briefs, config] = await Promise.all([
        prisma.clientBrief.findMany({ orderBy: { updatedAt: 'desc' } }),
        prisma.clientBriefConfig.findUnique({ where: { id: 'default' } }),
    ])
    return NextResponse.json({ briefs, rates: normalizeRates(config?.rates) })
}

/** Create a new brief link for a client. Body: { club, contactName?, currentSite?, location? } */
export async function POST(request: Request) {
    if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    const club = String(body.club || '').trim().slice(0, 120)
    if (!club) return NextResponse.json({ error: 'Club name is required' }, { status: 400 })
    const contactName = String(body.contactName || '').trim().slice(0, 120)
    const currentSite = String(body.currentSite || '').trim().slice(0, 300)
    const location = String(body.location || '').trim().slice(0, 120)

    const answers: Record<string, string> = { club }
    if (contactName) answers.contact_name = contactName
    if (currentSite) answers.current_site = currentSite
    if (location) answers.location = location

    const brief = await prisma.clientBrief.create({
        data: { token: makeToken(club), club, contactName: contactName || null, answers },
    })
    return NextResponse.json({ brief }, { status: 201 })
}
