import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Create Account | AIM Studio',
    description: 'Join AIM Studio. Create your account to access exclusive content, track casting applications, and be part of AI-powered filmmaking.',
    openGraph: {
        title: 'Create Account | AIM Studio',
        description: 'Join AIM Studio. Create your account today.',
    },
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
    return children
}
