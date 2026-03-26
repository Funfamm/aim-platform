import { redirect } from 'next/navigation'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import TrainingCatalogClient from './TrainingCatalogClient'

export const metadata = {
    title: 'Training Hub | AIM Studio',
    description: 'Level up your filmmaking craft with courses, workshops, and resources from AIM Studio.',
}

export default async function TrainingPage() {
    const session = await getUserSession()
    if (!session) redirect('/login?redirect=/training')
    const isLoggedIn = true
    const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } })

    if (!(settings as any)?.trainingEnabled) {
        return (
            <>
<main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2rem' }}>
                    <div>
                        <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎓</div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '8px' }}>Training Hub: Coming Soon</h1>
                        <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto', lineHeight: 1.7 }}>
                            We&apos;re building a world-class training experience for aspiring filmmakers, actors, and creatives.
                        </p>
                        <Link href="/" style={{
                            display: 'inline-block', marginTop: '24px',
                            padding: '10px 28px', borderRadius: 'var(--radius-full)',
                            background: 'var(--accent-gold)', color: '#0a0a0a',
                            fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none',
                        }}>← Back Home</Link>
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

    return (
        <>
<TrainingCatalogClient courses={serialized} isLoggedIn={isLoggedIn} />
            <Footer />
        </>
    )
}
