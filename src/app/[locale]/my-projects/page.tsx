import { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import type { Metadata } from 'next'
import MyProjectsClient from '@/components/start-project/MyProjectsClient'

export const metadata: Metadata = {
    title: 'My Projects — AIM Studio',
    description: 'Track the progress of your project requests submitted to AIM Studio.',
}

export default async function MyProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params
    setRequestLocale(locale)

    return (
        <main className="sp-bottom-safe" style={{
            minHeight: '100vh',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
        }}>
            <section style={{
                maxWidth: '900px',
                margin: '0 auto',
                padding: 'clamp(1rem, 3vw, 2rem) clamp(1rem, 3vw, 1.5rem) clamp(2rem, 5vw, 4rem)',
            }}>
                <Suspense fallback={
                    <div style={{ textAlign: 'center', paddingTop: 'clamp(3rem, 8vw, 6rem)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading...</p>
                    </div>
                }>
                    <MyProjectsClient />
                </Suspense>
            </section>
        </main>
    )
}
