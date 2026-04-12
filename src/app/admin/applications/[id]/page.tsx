import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getSessionAndRefresh } from '@/lib/auth'
import { prisma } from '@/lib/db'
import ApplicationDetailClient from '@/components/ApplicationDetailClient'
import AdminSidebar from '@/components/AdminSidebar'

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getSessionAndRefresh()
    if (!session) redirect('/admin/login')
    const isSuperAdmin = session.role === 'superadmin'

    const { id } = await params
    const application = await prisma.application.findUnique({
        where: { id },
        include: {
            castingCall: {
                include: { project: true },
            },
        },
    })

    if (!application) notFound()

    // Parse stored data
    let photos: string[] = []
    try { photos = application.headshotPath ? JSON.parse(application.headshotPath) : [] } catch { photos = [] }

    let experienceData = { text: '', specialSkills: '', personality: { describe_yourself: '', why_acting: '', dream_role: '', unique_quality: '' } }
    try { experienceData = JSON.parse(application.experience) } catch { experienceData = { text: application.experience, specialSkills: '', personality: { describe_yourself: '', why_acting: '', dream_role: '', unique_quality: '' } } }

    let socialData = { primary: { platform: '', username: '' }, secondary: null as { platform: string; username: string } | null }
    try { socialData = application.portfolioUrl ? JSON.parse(application.portfolioUrl) : socialData } catch { /* keep default */ }

    let aiReport = null
    try { aiReport = application.aiReport ? JSON.parse(application.aiReport) : null } catch { /* keep null */ }

    return (
        <div className="admin-layout">
            <AdminSidebar />

            <main className="admin-main">
                <div style={{ marginBottom: 'var(--space-md)' }}>
                    <Link href="/admin/applications" className="btn btn-ghost" style={{ padding: '0' }}>← Back to Applications</Link>
                </div>

                <ApplicationDetailClient
                    application={{
                        id: application.id,
                        fullName: application.fullName,
                        email: application.email,
                        phone: application.phone,
                        age: application.age,
                        gender: application.gender,
                        location: application.location,
                        status: application.status,
                        aiScore: application.aiScore,
                        aiFitLevel: application.aiFitLevel,
                        adminNotes: application.adminNotes,
                        createdAt: application.createdAt.toISOString(),
                        resultVisibleAt: application.resultVisibleAt?.toISOString() || null,
                        statusNote: application.statusNote || null,
                        auditState: (application as any).auditState ?? null,
                        adminRevealOverride: (application as any).adminRevealOverride ?? false,
                        pendingNotifyStatus: (application as any).pendingNotifyStatus ?? null,
                        notifyAfter: (application as any).notifyAfter?.toISOString() ?? null,
                    }}
                    castingCall={{
                        roleName: application.castingCall.roleName,
                        roleType: application.castingCall.roleType,
                        roleDescription: application.castingCall.roleDescription,
                        requirements: application.castingCall.requirements,
                        projectTitle: application.castingCall.project.title,
                    }}
                    photos={photos}
                    voicePath={application.selfTapePath}
                    experienceData={experienceData}
                    socialData={socialData}
                    aiReport={aiReport}
                    isSuperAdmin={isSuperAdmin}
                />
            </main>
        </div>
    )
}
