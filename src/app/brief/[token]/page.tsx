import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata, Viewport } from 'next'
import { Big_Shoulders, JetBrains_Mono } from 'next/font/google'
import { prisma } from '@/lib/db'
import { DEMO_TOKEN, sanitizeAnswers } from '@/lib/client-brief/schema'
import BriefExperience from './BriefExperience'

const display = Big_Shoulders({ subsets: ['latin'], weight: ['700', '800', '900'], variable: '--brief-display', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['500', '700'], variable: '--brief-mono', display: 'swap' })

export const dynamic = 'force-dynamic'
export const viewport: Viewport = { themeColor: '#05080A' }

const load = cache(async (token: string) => {
    if (token === DEMO_TOKEN) {
        return { club: 'Dunamis FC', status: 'in_progress', demo: true,
            answers: { club: 'Dunamis FC', current_site: 'https://dunamisfc.com', location: 'New York' } }
    }
    if (!/^[a-z0-9-]{4,64}$/.test(token)) return null
    const b = await prisma.clientBrief.findUnique({ where: { token }, select: { club: true, status: true, answers: true } })
    if (!b) return null
    return { club: b.club, status: b.status, demo: false, answers: sanitizeAnswers(b.answers) }
})

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
    const { token } = await params
    const b = await load(token).catch(() => null)
    return {
        title: b ? `${b.club} · Website brief | AIM Studio` : 'Website brief | AIM Studio',
        description: 'Tell AIM Studio what your new website needs to do.',
        robots: { index: false, follow: false },
    }
}

export default async function BriefPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params
    const b = await load(token)
    if (!b) notFound()
    return (
        <BriefExperience
            token={token}
            club={b.club}
            initialStatus={b.status}
            initialAnswers={b.answers}
            demo={b.demo}
            fontClass={`${display.variable} ${mono.variable}`}
        />
    )
}
