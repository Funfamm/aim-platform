import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Donate | AIM Studio',
    description: 'Support AI-powered filmmaking. Every dollar brings a story to life. Fund innovation, empower artists, and help create cinema that matters.',
    openGraph: {
        title: 'Donate | AIM Studio',
        description: 'Support AI-powered filmmaking. Every dollar brings a story to life.',
    },
}

export default function DonateLayout({ children }: { children: React.ReactNode }) {
    return children
}
