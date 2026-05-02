import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Outreach Center – AIM Studio Admin',
    description:
        'Compose and send announcements, surveys, and campaigns to your audience — all from one unified admin dashboard.',
}

export default function OutreachLayout({ children }: { children: React.ReactNode }) {
    return children
}
