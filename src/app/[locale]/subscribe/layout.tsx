import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Subscribe | AIM Studio',
    description: 'Stay in the loop. Get notified about new film releases, casting opportunities, and studio updates from AIM Studio.',
    openGraph: {
        title: 'Subscribe | AIM Studio',
        description: 'Get notified about new film releases, casting opportunities, and studio updates.',
    },
}

export default function SubscribeLayout({ children }: { children: React.ReactNode }) {
    return children
}
