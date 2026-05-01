import dynamic from 'next/dynamic'
import Footer from '@/components/Footer'
const UpcomingProjects3D = dynamic(() => import('@/components/UpcomingProjects3D'))
import { prisma } from '@/lib/db'

export const revalidate = 120

export const metadata = {
    title: 'Upcoming Projects | AIM Studio',
    description: 'Discover upcoming AI-crafted films and productions from AIM Studio. New stories on the horizon.',
}

export default async function UpcomingPage() {
    const upcomingProjects = await prisma.project.findMany({
        where: { status: { in: ['upcoming', 'in-production'] }, published: true },
        orderBy: { sortOrder: 'asc' },
        include: {
            castingCalls: {
                where: { status: 'open' },
            },
        },
    })

    const siteSettings = await prisma.siteSettings.findFirst({ select: { upcomingPageData: true } }).catch(() => null)


    return (
        <>
<main id="main-content">
                <UpcomingProjects3D projects={upcomingProjects} overrides={siteSettings?.upcomingPageData || null} />
            </main>

            <Footer />
        </>
    )
}
