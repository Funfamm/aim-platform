import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Contact | AIM Studio',
    description: 'Get in touch with AIM Studio. Partnerships, questions, or just say hello. We\'d love to hear from you.',
    openGraph: {
        title: 'Contact | AIM Studio',
        description: 'Get in touch with AIM Studio. We\'d love to hear from you.',
    },
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
    return children
}
