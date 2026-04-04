import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Create Account | AIM Studio',
    description: 'Join AIM Studio. Create your account to access exclusive content, track casting applications, and be part of AI-powered filmmaking.',
    openGraph: {
        title: 'Create Account | AIM Studio',
        description: 'Join AIM Studio. Create your account today.',
    },
}

import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function RegisterLayout({ children, params }: { children: React.ReactNode, params: Promise<{ locale: string }> }) {
    const session = await getSession()
    if (session) {
        const p = await params
        redirect(`/${p.locale}/dashboard`)
    }
    return children
}
