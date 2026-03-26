import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Dashboard | AIM Studio',
    description: 'Your AIM Studio dashboard. Track your casting applications, manage your profile, and stay updated on your journey.',
    openGraph: {
        title: 'Dashboard | AIM Studio',
        description: 'Your AIM Studio dashboard.',
    },
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return children
}
