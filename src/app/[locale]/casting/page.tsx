import Footer from '@/components/Footer'
import CastingPageClient from '@/components/CastingPageClient'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import { getUserSession } from '@/lib/auth'

// Must be dynamic so the auth check runs on every request.
// If this page were cached (ISR), a signed-in user's render would be
// served to signed-out visitors, bypassing the requireLoginForCasting gate.

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Casting Calls | AIM Studio',
    description: 'Apply for roles in upcoming AIM Studio productions. Open casting calls for actors and performers of all experience levels.',
}


export default async function CastingPage() {
    // Check global toggle
    const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } })

    const session = await getUserSession();
    // Access gate: require login if setting is enabled
  if (settings?.requireLoginForCasting && !session) {
    redirect('/login');
  }
    if (settings && settings.castingCallsEnabled === false) {
        return (
            <>
                <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
                    <div>
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎭</div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '8px' }}>Casting Calls Paused</h1>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                            We are not currently accepting casting applications. Please check back soon for new opportunities.
                        </p>
                    </div>
                </main>
                <Footer />
            </>
        )
    }

    const castingCalls = await prisma.castingCall.findMany({
        where: { status: 'open' },
        include: {
            project: {
                select: {
                    id: true,
                    title: true,
                    slug: true,
                    genre: true,
                    year: true,
                    coverImage: true,
                    translations: true,
                },
            },
            _count: {
                select: { applications: true },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
    })

    // Fetch user's applications with status
    let appliedMap: Record<string, string> = {}
    if (session?.userId) {
        const userApplications = await prisma.application.findMany({
            where: { userId: session.userId },
            select: { castingCallId: true, status: true },
        })
        appliedMap = Object.fromEntries(userApplications.map(a => [a.castingCallId, a.status]))
    }

    return (
        <>
            <CastingPageClient castingCalls={castingCalls} appliedMap={appliedMap} />
            <Footer />
        </>
    )
}
