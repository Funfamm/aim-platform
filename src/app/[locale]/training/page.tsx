import Footer from '@/components/Footer'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import TrainingCatalogClient from './TrainingCatalogClient'
import { getLocale, getTranslations } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Training Hub | AIM Studio',
    description: 'Level up your filmmaking craft with courses, workshops, and resources from AIM Studio.',
}

export default async function TrainingPage() {
    const session = await getUserSession()
    const locale = await getLocale()
    const t = await getTranslations('trainingPaused')
    const isLoggedIn = !!session
    let settings = null
    try { settings = await prisma.siteSettings.findFirst() } catch { /* schema drift */ }

    if (!(settings as any)?.trainingEnabled) {
        return (
            <>
<main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
                    <div>
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎓</div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '8px' }}>{t('title')}</h1>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.7 }}>
                            {t('description')}
                        </p>
                        <Link href="/" style={{
                            display: 'inline-block', marginTop: '24px',
                            padding: '10px 28px', borderRadius: 'var(--radius-full)',
                            background: 'var(--accent-gold)', color: '#0a0a0a',
                            fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none',
                        }}>{t('backHome')}</Link>
                    </div>
                </main>
                <Footer />
            </>
        )
    }

    const courses = await prisma.course.findMany({
        where: { published: true },
        orderBy: { sortOrder: 'asc' },
        include: {
            modules: {
                orderBy: { sortOrder: 'asc' },
                include: { lessons: { select: { id: true, duration: true } } },
            },
            _count: { select: { enrollments: true } },
        },
    })

    // Serialize for client component
    const serialized = JSON.parse(JSON.stringify(courses))

    // Check if logged-in user is already subscribed to training_general Notify Me
    let notifySubscribed = false
    if (session?.userId) {
        try {
            const userEmail = (await prisma.user.findUnique({ where: { id: session.userId as string }, select: { email: true } }))?.email
            if (userEmail) {
                const ns = await prisma.notificationSignup.findUnique({
                    where: { email_signupTag: { email: userEmail.trim().toLowerCase(), signupTag: 'training_general' } },
                    select: { status: true },
                })
                notifySubscribed = ns?.status === 'active'
            }
        } catch { /* ignore */ }
    }

    return (
        <>
<TrainingCatalogClient courses={serialized} isLoggedIn={isLoggedIn} notifySubscribed={notifySubscribed} />
            <Footer />
        </>
    )
}
