import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import ApplicationDetailClient from '@/components/ApplicationDetailClient'

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await getSession()
    if (!session) redirect('/admin/login')

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
            <aside className="admin-sidebar">
                <div className="admin-sidebar-logo">
                    <Link href="/" style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 800 }}>
                        <span style={{ color: 'var(--accent-gold)' }}>AIM</span> Studio
                    </Link>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>Admin Panel</div>
                </div>
                <ul className="admin-sidebar-nav">
                    <li><Link href="/admin/analytics">📊 Analytics</Link></li>
                    <li><Link href="/admin/projects">🎬 Projects</Link></li>
                    <li><Link href="/admin/casting">🎭 Casting</Link></li>
                    <li><Link href="/admin/applications" className="active">📋 Applications</Link></li>
                    <li><Link href="/admin/media">🖼️ Page Media</Link></li>
                    <li><Link href="/admin/sponsors">🤝 Sponsors</Link></li>
                    <li><Link href="/admin/donations">💰 Donations</Link></li>
                    <li><Link href="/admin/users">👥 Users</Link></li>
                    <li><Link href="/admin/scripts">✍️ Scripts</Link></li>
                    <li><Link href="/admin/settings">⚙️ Settings</Link></li>
                </ul>
            </aside>

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
                />
            </main>
        </div>
    )
}
