import { notFound, redirect } from 'next/navigation'
import Footer from '@/components/Footer'
import ApplicationForm from '@/components/ApplicationForm'
import CinematicBackground from '@/components/CinematicBackground'
import AlreadyAppliedView from '@/components/casting/AlreadyAppliedView'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { getTranslations, getLocale } from 'next-intl/server'
import { translateStatusNote } from '@/lib/translate'

export const dynamic = 'force-dynamic'

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

export default async function ApplyPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ reapply?: string }>
}) {
    const { id } = await params
    const { reapply } = await searchParams

    // Require login to apply
    const session = await getUserSession()
    const locale = await getLocale()
    if (!session?.userId) {
        redirect(`/${locale}/login?redirect=/casting/${id}/apply`)
    }
    const isAdmin = session.role === 'admin' || session.role === 'superadmin'

    // Fetch casting call (required for both paths)
    const castingCall = await prisma.castingCall.findUnique({
        where: { id },
        include: {
            project: {
                select: { title: true, slug: true, genre: true },
            },
        },
    })
    if (!castingCall || castingCall.status !== 'open') notFound()

    // Check for existing application by this user
    const existingApplication = isAdmin
        ? null
        : await prisma.application.findFirst({
            where: { castingCallId: id, userId: session.userId },
            select: {
                id: true, fullName: true, email: true, phone: true,
                age: true, gender: true, location: true, specialSkills: true,
                status: true, statusNote: true, resultVisibleAt: true,
                createdAt: true, castingCallId: true,
            },
        })

    // If they already applied and are NOT coming back via ?reapply=1 after a withdrawal, show status page
    if (existingApplication && existingApplication.status !== 'withdrawn') {
        const now = new Date()
        const isRevealed = !existingApplication.resultVisibleAt || existingApplication.resultVisibleAt <= now
        const translatedStatusNote = isRevealed
            ? await translateStatusNote(existingApplication.statusNote, locale, existingApplication.id)
            : null

        const applicationInfo = {
            id:             existingApplication.id,
            fullName:       existingApplication.fullName,
            email:          existingApplication.email,
            phone:          existingApplication.phone,
            age:            existingApplication.age,
            gender:         existingApplication.gender,
            location:       existingApplication.location,
            specialSkills:  existingApplication.specialSkills,
            status:              existingApplication.status as string,
            statusNote:          translatedStatusNote,
            resultVisibleAt:     existingApplication.resultVisibleAt?.toISOString() ?? null,
            createdAt:           existingApplication.createdAt.toISOString(),
            castingCallId:       id,
            roleName:            castingCall.roleName,
            projectTitle:        castingCall.project.title,
            projectSlug:         castingCall.project.slug,
            auditState:          (existingApplication as any).auditState ?? null,
            adminRevealOverride: (existingApplication as any).adminRevealOverride ?? false,
        }

        const tAlready = await getTranslations('alreadyApplied')

        return (
            <>
                <CinematicBackground variant="casting" />
                <main className="apply-page">
                    <div className="container">
                        <div className="section-header" style={{ marginBottom: 'var(--space-xl)' }}>
                            <span className="text-label">{tAlready('pageLabel')}</span>
                            <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)' }}>
                                <span style={{ color: 'var(--accent-gold)' }}>{castingCall.roleName}</span>
                            </h1>
                            <div className="divider divider-center" />
                        </div>
                        <AlreadyAppliedView application={applicationInfo} />
                    </div>
                </main>
                <Footer />
            </>
        )
    }

    // If withdrawn and ?reapply=1 present → show the form again
    // (or if no existing application at all)
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
