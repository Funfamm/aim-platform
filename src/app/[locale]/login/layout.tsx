import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Sign In | AIM Studio',
    description: 'Sign in to your AIM Studio account to access your dashboard, track casting applications, and manage your profile.',
    openGraph: {
        title: 'Sign In | AIM Studio',
        description: 'Sign in to your AIM Studio account.',
    },
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return children
}
