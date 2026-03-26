import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Reset Password | AIM Studio',
    description: 'Reset your AIM Studio account password.',
    openGraph: {
        title: 'Reset Password | AIM Studio',
        description: 'Reset your AIM Studio account password.',
    },
}

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
    return children
}
