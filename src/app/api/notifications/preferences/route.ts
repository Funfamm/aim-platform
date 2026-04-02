import { NextResponse } from 'next/server'
import { getSessionAndRefresh } from '@/lib/auth'
import { prisma } from '@/lib/db'

/** GET /api/notifications/preferences */
export async function GET() {
    const session = await getSessionAndRefresh()
    if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = prisma as any
    let pref = await db.userNotificationPreference.findUnique({ where: { userId: session.id } })

    // Auto-create with defaults if not exists
    if (!pref) {
        pref = await db.userNotificationPreference.create({
            data: {
                userId: session.id,
                newRole: true, announcement: true, contentPublish: false, statusChange: true,
                email: true, inApp: true,
            }
        })
    }

    return NextResponse.json({ preferences: pref })
}

/** PUT /api/notifications/preferences */
export async function PUT(req: Request) {
    return savePreferences(req)
}

/** POST /api/notifications/preferences (alias for PUT – used by the UI) */
export async function POST(req: Request) {
    return savePreferences(req)
}

async function savePreferences(req: Request) {
    const session = await getSessionAndRefresh()
    if (!session?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    try {
        const body = await req.json()
        const boolFields = ['newRole', 'announcement', 'contentPublish', 'statusChange', 'email', 'inApp']
        const data: Record<string, boolean> = {}

        for (const k of boolFields) {
            if (typeof body[k] === 'boolean') data[k] = body[k]
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const pref = await db.userNotificationPreference.upsert({
            where: { userId: session.id },
            update: data,
            create: {
                userId: session.id,
                newRole: true, announcement: true, contentPublish: false, statusChange: true,
                email: true, inApp: true,
                ...data,
            },
        })

        return NextResponse.json({ preferences: pref })
    } catch (err) {
        console.error('Notification preferences save error:', err)
        return NextResponse.json(
            { error: 'Failed to save preferences', details: err instanceof Error ? err.message : String(err) },
            { status: 500 }
        )
    }
}
