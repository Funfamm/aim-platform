/**
 * Watch Party Page — Server Component
 * /{locale}/events/watch/{roomName}
 * --------------------------------------------------------------------------
 * Loads event + linked project, validates access, resolves media URL,
 * and renders WatchPartyShell with all necessary props.
 *
 * Security: the mediaUrl passed to WatchPartyShell is the filmUrl resolved
 * server-side. If the platform adds R2 presigning later, this is the one
 * place to add it — the client component never knows or stores the raw URL.
 *
 * Watch Party events are cinema-mode only. No LiveKit is used.
 */

import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getTranslations } from 'next-intl/server'
import WatchPartyShell from '@/components/live/WatchPartyShell'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface WatchPartyPageProps {
    params: Promise<{ locale: string; roomName: string }>
    searchParams: Promise<{ invite?: string; replay?: string }>
}

export async function generateMetadata({ params }: WatchPartyPageProps) {
    const { roomName } = await params
    let event = null
    try {
        event = await prisma.liveEvent.findUnique({
            where: { roomName },
            select: { title: true, status: true },
        })
    } catch { /* non-critical */ }

    return {
        title: event ? `${event.title} — Watch Party | AIM Studio` : 'Watch Party | AIM Studio',
        description: 'Join the live Watch Party screening on AIM Studio.',
        robots: { index: false, follow: false },
    }
}

export default async function WatchPartyPage({ params, searchParams }: WatchPartyPageProps) {
    const { locale, roomName } = await params
    const { replay } = await searchParams

    const session = await getSession()
    const t = await getTranslations({ locale, namespace: 'eventRoom' })

    // ── Load event ────────────────────────────────────────────────────────────
    interface EventRow {
        id: string; title: string; status: string; eventType: string; hostUserId: string
        lobbyEnabled: boolean; replayEnabled: boolean; lastCheckpointSec: number | null
        scheduledAt: Date | null; projectId: string | null; episodeId: string | null
        project: {
            id: string; title: string; slug: string
            filmUrl: string | null; coverImage: string | null
            episodes: { id: string; title: string; number: number; season: number; videoUrl: string | null }[]
        } | null
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let event: EventRow | null = null
    try {
        const row = await prisma.liveEvent.findUnique({
            where: { roomName },
            select: {
                id: true, title: true, status: true, eventType: true, hostUserId: true,
                lobbyEnabled: true, replayEnabled: true, lastCheckpointSec: true,
                scheduledAt: true, projectId: true, episodeId: true,
                project: {
                    select: {
                        id: true, title: true, slug: true, filmUrl: true, coverImage: true,
                        episodes: {
                            select: { id: true, title: true, number: true, season: true, videoUrl: true },
                            orderBy: { number: 'asc' },
                        },
                    },
                },
            },
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        event = (row as any) as EventRow | null
    } catch (e) {
        console.error('[WatchPartyPage] DB error:', e)
    }

    if (!event) {
        return (
            <main style={{
                minHeight: '100vh', background: '#080810',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-primary, \'Inter\', sans-serif)',
                padding: '40px 24px',
            }}>
                <div style={{
                    textAlign: 'center', maxWidth: '460px', width: '100%',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '20px', padding: '48px 36px',
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🔗</div>
                    <h1 style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 700, marginBottom: '12px' }}>
                        {t('linkInactive')}
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: '32px', fontSize: '0.95rem' }}>
                        {t('linkInactiveDesc')}
                    </p>
                    <Link
                        href="/"
                        style={{
                            display: 'inline-block', padding: '12px 28px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #d4a853, #c9951b)',
                            color: '#000', fontWeight: 700, textDecoration: 'none',
                            fontSize: '0.9rem',
                        }}
                    >
                        {t('backToHomepage')}
                    </Link>
                </div>
            </main>
        )
    }

    // ── Guard: only watch_party events ────────────────────────────────────────
    if (event.eventType !== 'watch_party') {
        // This is a LiveKit event; redirect to the standard room page
        redirect(`/${locale}/events/${roomName}`)
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    if (!session?.userId) {
        // Not signed in → sign-in page, which will redirect back
        redirect(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/events/watch/${roomName}`)}`)
    }

    const isAdmin = session.role === 'admin' || session.role === 'superadmin'
    const isHost  = session.userId === event.hostUserId
    const canControl = isAdmin || isHost

    // ── Resolve media URL ─────────────────────────────────────────────────────
    // Pin to a specific episode if episodeId is set; otherwise use filmUrl.
    // The URL is passed directly for now. If R2 presigning is added later,
    // implement generatePresignedUrl() here — no client changes needed.
    let mediaUrl: string | null = null
    let mediaTitle = event.project?.title ?? event.title

    if (event.episodeId && event.project) {
        const episode = event.project.episodes.find(ep => ep.id === event.episodeId)
        if (episode?.videoUrl) {
            mediaUrl   = episode.videoUrl
            mediaTitle = `${event.project.title} — ${episode.title}`
        }
    }
    if (!mediaUrl && event.project?.filmUrl) {
        mediaUrl = event.project.filmUrl
    }

    // ── Ended state ───────────────────────────────────────────────────────────
    const isEnded   = event.status === 'ended'
    const canReplay = isEnded && event.replayEnabled && !!replay

    if (isEnded && !canReplay && !canControl) {
        // Show ended card — not a 404
        return (
            <div style={{
                minHeight: '100vh',
                background: 'var(--bg-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '24px',
                padding: '40px 24px',
                fontFamily: 'inherit',
            }}>
                <style>{`
                    .wp-ended-card {
                        background: linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));
                        border: 1px solid rgba(255,255,255,0.1);
                        border-radius: 20px;
                        padding: 48px 40px;
                        max-width: 480px;
                        width: 100%;
                        text-align: center;
                        animation: fadeInUp 0.4s ease;
                    }
                    @keyframes fadeInUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
                <div className="wp-ended-card">
                    <div style={{ fontSize: '3rem', marginBottom: '20px' }}>🎬</div>
                    <h1 style={{
                        fontSize: '1.5rem', fontWeight: 700,
                        color: 'var(--text-primary)', marginBottom: '12px',
                    }}>
                        {t('eventEnded')}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '32px' }}>
                        <strong>{event.title}</strong> {t('hasEnded')}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                        {event.replayEnabled && mediaUrl && (
                            <Link
                                href={`/${locale}/events/watch/${roomName}?replay=1`}
                                style={{
                                    display: 'inline-block',
                                    padding: '12px 28px',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, var(--accent-gold), #c9951b)',
                                    color: '#000',
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                    width: '100%',
                                    boxSizing: 'border-box',
                                }}
                            >
                                🎞️ {t('watchReplay')}
                            </Link>
                        )}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
                            <Link
                                href="/"
                                style={{
                                    display: 'inline-block',
                                    padding: '10px 22px',
                                    borderRadius: '10px',
                                    background: 'linear-gradient(135deg, #d4a853, #c9951b)',
                                    color: '#000',
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                    fontSize: '0.9rem',
                                }}
                            >
                                {t('backToHome')}
                            </Link>
                            <Link
                                href={`/${locale}/dashboard`}
                                style={{
                                    display: 'inline-block',
                                    padding: '10px 22px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    color: 'var(--text-secondary)',
                                    textDecoration: 'none',
                                    fontSize: '0.9rem',
                                }}
                            >
                                {t('backToDashboard')}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <WatchPartyShell
            roomName={roomName}
            locale={locale}
            eventId={event.id}
            title={event.title}
            mediaTitle={mediaTitle}
            mediaUrl={mediaUrl}
            coverImage={event.project?.coverImage ?? null}
            status={event.status as 'scheduled' | 'live' | 'ended'}
            lobbyEnabled={event.lobbyEnabled}
            replayEnabled={event.replayEnabled}
            isReplay={!!replay}
            lastCheckpointSec={event.lastCheckpointSec ?? 0}
            canControl={canControl}
            userPreferredLang={(session.preferredLanguage as string | undefined) ?? 'en'}
            subtitleProjectId={event.project?.id ?? null}
            scheduledAt={event.scheduledAt?.toISOString() ?? null}
            projectSlug={event.project?.slug ?? null}
        />
    )
}
