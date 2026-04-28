import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Donate | AIM Studio',
    description: 'Support creating cinema with AI. Every dollar brings a story to life. Fund innovation, empower artists, and help create cinema that matters.',
    openGraph: {
        title: 'Donate | AIM Studio',
        description: 'Support creating cinema with AI. Every dollar brings a story to life.',
    },
}

export default function DonateLayout({ children }: { children: React.ReactNode }) {
    return children
}
