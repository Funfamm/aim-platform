import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Sign In | AIM Studio',
    description: 'Sign in to your AIM Studio account to access your dashboard, track casting applications, and manage your profile.',
    openGraph: {
        title: 'Sign In | AIM Studio',
        description: 'Sign in to your AIM Studio account.',
    },
}

import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function LoginLayout({ children, params }: { children: React.ReactNode, params: Promise<{ locale: string }> }) {
    const session = await getSession()
    if (session) {
        const p = await params
        redirect(`/${p.locale}/dashboard`)
    }
    return children
}
