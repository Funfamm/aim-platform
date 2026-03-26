import { notFound, redirect } from 'next/navigation'
import Footer from '@/components/Footer'
import ApplicationForm from '@/components/ApplicationForm'
import CinematicBackground from '@/components/CinematicBackground'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { getTranslations, getLocale } from 'next-intl/server'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const castingCall = await prisma.castingCall.findUnique({
        where: { id },
        include: { project: true },
    })
    if (!castingCall) return { title: 'Not Found' }
    return {
        title: `Apply for ${castingCall.roleName} | ${castingCall.project.title} | AIM Studio`,
        description: `Apply for the role of ${castingCall.roleName} in ${castingCall.project.title}.`,
    }
}

export default async function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    // Require login to apply
    const session = await getUserSession()
    if (!session?.userId) {
        redirect(`/login?redirect=/casting/${id}/apply`)
    }
    const isAdmin = session.role === 'admin' || session.role === 'superadmin'

    const locale = await getLocale()

    const castingCall = await prisma.castingCall.findUnique({
        where: { id },
        include: {
            project: {
                select: {
                    title: true,
                    genre: true,
                },
            },
        },
    })

    if (!castingCall || castingCall.status !== 'open') notFound()

    // Resolve translated role content for the user's locale
    const tr = (() => {
        if (locale === 'en' || !(castingCall as { translations?: string | null }).translations) return null
        try { return JSON.parse((castingCall as { translations?: string | null }).translations as string)?.[locale] || null } catch { return null }
    })()
    const castingCallForForm = {
        ...castingCall,
        roleName: tr?.roleName || castingCall.roleName,
        roleDescription: tr?.roleDescription || castingCall.roleDescription,
    }

    const t = await getTranslations('castingForm')

    return (
        <>
<CinematicBackground variant="casting" />
            <main className="apply-page">
                <div className="container">

                    <div className="section-header" style={{ marginBottom: 'var(--space-xl)' }}>
                        <span className="text-label">{t('pageLabel')}</span>
                        <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)' }}>
                            {t('applyFor')} <span style={{ color: 'var(--accent-gold)' }}>{castingCall.roleName}</span>
                        </h1>
                        <div className="divider divider-center" />
                    </div>
                    <ApplicationForm castingCall={castingCallForForm} isAdmin={isAdmin} />
                </div>
            </main>
            <Footer />
        </>
    )
}
