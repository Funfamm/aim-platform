import Footer from '@/components/Footer'
import CastingPageClient from '@/components/CastingPageClient'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { getLocale, getTranslations } from 'next-intl/server'

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
    let settings = null
    try { settings = await prisma.siteSettings.findFirst() } catch { /* schema drift */ }
    const locale = await getLocale()
    const t = await getTranslations('castingPaused')

    const session = await getUserSession();
    const isLoggedIn = !!session
    if (settings && settings.castingCallsEnabled === false) {
        return (
            <>
                <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
                    <div>
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎭</div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '8px' }}>{t('title')}</h1>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto' }}>
                            {t('description')}
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

    // Fetch user's applications with status (logged-in only)
    let appliedMap: Record<string, string> = {}
    if (session?.userId) {
        const userApplications = await prisma.application.findMany({
            where: { userId: session.userId },
            select: { castingCallId: true, status: true },
        })
        appliedMap = Object.fromEntries(userApplications.map(a => [a.castingCallId, a.status]))
    }

    // Check if logged-in user is already subscribed to casting_general Notify Me
    let notifySubscribed = false
    if (session?.userId) {
        try {
            const userEmail = (await prisma.user.findUnique({ where: { id: session.userId as string }, select: { email: true } }))?.email
            if (userEmail) {
                const ns = await prisma.notificationSignup.findUnique({
                    where: { email_signupTag: { email: userEmail.trim().toLowerCase(), signupTag: 'casting_general' } },
                    select: { status: true },
                })
                notifySubscribed = ns?.status === 'active'
            }
        } catch { /* ignore */ }
    }

    return (
        <>
            <style>{`
                .fadeIn {
                    opacity: 0;
                    animation: fadeIn 0.6s ease-out forwards;
                }
                @keyframes fadeIn {
                    to { opacity: 1; }
                }
            `}</style>
            <div className="fadeIn">
                <CastingPageClient castingCalls={castingCalls} appliedMap={appliedMap} isLoggedIn={isLoggedIn} notifySubscribed={notifySubscribed} />
                <Footer />
            </div>
        </>

    )
}
