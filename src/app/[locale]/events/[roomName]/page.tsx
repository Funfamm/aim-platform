import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import RoomShell from '@/components/live/RoomShell'
import type { LiveKitRole } from '@/lib/livekit/grants'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface EventPageProps {
    params: Promise<{ locale: string; roomName: string }>
}

export async function generateMetadata({ params }: EventPageProps) {
    const { roomName } = await params
    const event = await prisma.liveEvent.findUnique({
        where: { roomName },
        select: { title: true, status: true, eventType: true },
    })
    const typeLabel = (
        { general: 'Live Event', audition: 'Live Audition', q_and_a: 'Q&A', watch_party: 'Watch Party' } as Record<string, string>
    )[event?.eventType ?? ''] ?? 'Live'

    return {
        title: event ? `${event.title} — ${typeLabel} | AIM Studio` : 'Live Event | AIM Studio',
        description: event ? `Join the live ${typeLabel.toLowerCase()} on AIM Studio.` : undefined,
        // Do not index live room pages — they are transient and session-specific
        robots: { index: false, follow: false },
    }
}

export default async function EventPage({ params }: EventPageProps) {
    const { roomName } = await params
    const session = await getSession()

    const event = await prisma.liveEvent.findUnique({
        where: { roomName },
        select: {
            id: true,
            title: true,
            status: true,
            eventType: true,
            hostUserId: true,
            castingCallId: true,
            project: { select: { title: true, slug: true } },
        },
    })

    if (!event) notFound()

    // Determine effective role for this user
    const isAdmin = session?.role === 'admin' || session?.role === 'superadmin'
    const isHost = session?.userId === event.hostUserId
    let role: LiveKitRole = 'viewer'
    if (isAdmin) role = 'admin'
    else if (isHost) role = 'host'

    const eventEnded = event.status === 'ended'
    const isAuthenticated = !!session?.userId

    const eventTypeLabels: Record<string, string> = {
        general: 'Live Event',
        audition: 'Live Audition',
        q_and_a: 'Q&A Session',
        watch_party: 'Watch Party',
    }

    return (
        <>
            <style>{`
                .event-page {
                    min-height: 100vh;
                    background: #080810;
                    color: #f0f0f5;
                    font-family: var(--font-primary, 'Inter', sans-serif);
                    padding-top: 80px;
                }
                .event-page-header {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 1.5rem 1.5rem 0;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                }
                .event-breadcrumb {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.78rem;
                    color: rgba(255,255,255,0.4);
                }
                .event-breadcrumb a { color: inherit; text-decoration: none; }
                .event-breadcrumb a:hover { color: #d4a853; }
                .event-type-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.4rem;
                    background: rgba(212,168,83,0.1);
                    border: 1px solid rgba(212,168,83,0.25);
                    border-radius: 100px;
                    padding: 0.2rem 0.85rem;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: #d4a853;
                }
                .event-title-section {
                    max-width: 1200px;
                    margin: 1rem auto 0;
                    padding: 0 1.5rem 1rem;
                }
                .event-title {
                    font-size: clamp(1.4rem, 3vw, 2.2rem);
                    font-weight: 800;
                    letter-spacing: -0.02em;
                    color: #fff;
                    margin: 0 0 0.25rem;
                }
                .event-subtitle {
                    font-size: 0.8rem;
                    color: rgba(255,255,255,0.4);
                }
                .event-room-wrap {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 0 1.5rem 3rem;
                }

                /* ── Room shell styles ── */
                .room-shell {
                    border-radius: 16px;
                    overflow: hidden;
                    border: 1px solid rgba(255,255,255,0.06);
                    background: #0d0d1a;
                }
                .room-shell-header {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    background: rgba(255,255,255,0.03);
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .room-live-badge {
                    font-size: 0.65rem;
                    font-weight: 800;
                    color: #ef4444;
                    letter-spacing: 0.1em;
                    animation: pulse-red 2s ease-in-out infinite;
                }
                @keyframes pulse-red {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.4; }
                }
                .room-name-label {
                    font-size: 0.8rem;
                    color: rgba(255,255,255,0.5);
                    font-family: monospace;
                    flex: 1;
                }
                .room-shell-loading, .room-shell-error {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem;
                    gap: 1rem;
                    color: rgba(255,255,255,0.5);
                    font-size: 0.85rem;
                }
                .room-shell-spinner {
                    width: 36px; height: 36px;
                    border: 3px solid rgba(212,168,83,0.2);
                    border-top-color: #d4a853;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                .room-shell-retry-btn {
                    padding: 0.5rem 1.5rem;
                    background: rgba(212,168,83,0.1);
                    border: 1px solid rgba(212,168,83,0.3);
                    border-radius: 8px;
                    color: #d4a853;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 0.8rem;
                }
                .room-shell-video-area {
                    position: relative;
                    min-height: 480px;
                }

                /* ── Participant grid ── */
                .participant-grid {
                    display: grid;
                    gap: 4px;
                    padding: 4px;
                    min-height: 480px;
                    background: #080810;
                }
                .participant-grid--1 { grid-template-columns: 1fr; }
                .participant-grid--2 { grid-template-columns: repeat(2, 1fr); }
                .participant-grid--3, .participant-grid--4 { grid-template-columns: repeat(2, 1fr); }
                .participant-grid--5, .participant-grid--6 { grid-template-columns: repeat(3, 1fr); }
                .participant-tile {
                    position: relative;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #12121f;
                    aspect-ratio: 16/9;
                }
                .participant-video { width: 100%; height: 100%; object-fit: cover; }
                .participant-avatar {
                    width: 100%; height: 100%;
                    display: flex; align-items: center; justify-content: center;
                    background: linear-gradient(135deg, rgba(212,168,83,0.08), rgba(139,92,246,0.08));
                }
                .participant-avatar-initial {
                    font-size: 2.5rem;
                    font-weight: 800;
                    color: rgba(212,168,83,0.6);
                }
                .participant-name-tag {
                    position: absolute;
                    bottom: 0; left: 0; right: 0;
                    display: flex; align-items: center; gap: 0.4rem;
                    padding: 0.4rem 0.6rem;
                    background: linear-gradient(transparent, rgba(0,0,0,0.7));
                }
                .participant-name { font-size: 0.7rem; font-weight: 600; color: #fff; }
                .participant-badge {
                    font-size: 0.55rem; padding: 1px 6px; border-radius: 4px;
                    font-weight: 700; text-transform: uppercase;
                }
                .participant-badge--screen {
                    background: rgba(96,165,250,0.2); color: #60a5fa;
                }
                .participant-grid-empty {
                    grid-column: 1/-1;
                    display: flex; align-items: center; justify-content: center;
                    color: rgba(255,255,255,0.3); font-size: 0.85rem;
                    min-height: 480px;
                }

                /* ── Caption overlay ── */
                .caption-overlay {
                    position: absolute; bottom: 40px; left: 50%;
                    transform: translateX(-50%);
                    width: min(700px, calc(100% - 32px));
                    display: flex; flex-direction: column; gap: 4px;
                    pointer-events: none;
                    z-index: 20;
                }
                .caption-line {
                    background: rgba(0,0,0,0.75);
                    backdrop-filter: blur(8px);
                    border-radius: 6px;
                    padding: 0.4rem 0.8rem;
                    font-size: 0.9rem;
                    line-height: 1.4;
                    color: #fff;
                    animation: caption-in 0.2s ease-out;
                }
                @keyframes caption-in {
                    from { opacity: 0; transform: translateY(4px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .caption-speaker { font-weight: 700; color: #d4a853; margin-inline-end: 0.25rem; }
                .caption-text { color: rgba(255,255,255,0.9); }

                /* ── Language selector ── */
                .language-selector {
                    display: flex; align-items: center; gap: 0.5rem; margin-left: auto;
                }
                .language-selector-label {
                    font-size: 0.65rem; font-weight: 700;
                    text-transform: uppercase; letter-spacing: 0.06em;
                    color: rgba(255,255,255,0.4);
                }
                .language-selector-select {
                    background: rgba(255,255,255,0.06);
                    border: 1px solid rgba(255,255,255,0.12);
                    border-radius: 8px;
                    padding: 0.25rem 0.6rem;
                    font-size: 0.75rem;
                    color: #fff;
                    cursor: pointer;
                    outline: none;
                }
                .language-selector-select:focus {
                    border-color: rgba(212,168,83,0.5);
                }

                /* ── Teaser card (unauthenticated) ── */
                .event-teaser {
                    max-width: 560px;
                    margin: 3rem auto;
                    text-align: center;
                    padding: 3rem 2rem;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 20px;
                }
                .event-teaser-icon { font-size: 3rem; margin-bottom: 1rem; }
                .event-teaser h2 {
                    font-size: 1.5rem; font-weight: 800; color: #fff; margin: 0 0 0.5rem;
                }
                .event-teaser p {
                    color: rgba(255,255,255,0.5); font-size: 0.9rem; margin-bottom: 1.5rem; line-height: 1.5;
                }
                .event-teaser-btn {
                    display: inline-flex; align-items: center; gap: 0.5rem;
                    background: linear-gradient(135deg, #d4a853, #b8903f);
                    color: #000; padding: 0.75rem 2rem;
                    border-radius: 10px; font-weight: 700; font-size: 0.9rem;
                    text-decoration: none; transition: opacity 0.2s;
                }
                .event-teaser-btn:hover { opacity: 0.88; }

                /* ── Ended state ── */
                .event-ended {
                    text-align: center; padding: 3rem 1.5rem;
                    color: rgba(255,255,255,0.4);
                }
                .event-ended h2 { color: rgba(255,255,255,0.6); margin-bottom: 0.5rem; }
            `}</style>

            <main className="event-page">
                <div className="event-page-header">
                    <nav className="event-breadcrumb" aria-label="Breadcrumb">
                        <Link href="/">Home</Link>
                        <span>/</span>
                        {event.project && (
                            <>
                                <Link href={`/works/${event.project.slug}`}>{event.project.title}</Link>
                                <span>/</span>
                            </>
                        )}
                        <span style={{ color: 'rgba(255,255,255,0.6)' }}>Live Room</span>
                    </nav>
                    <span className="event-type-badge">
                        🎬 {eventTypeLabels[event.eventType] ?? 'Live'}
                    </span>
                </div>

                <div className="event-title-section">
                    <h1 className="event-title">{event.title}</h1>
                    {/* Only show internal room name to admins/hosts — not to public viewers */}
                    {(isAdmin || isHost) && (
                        <p className="event-subtitle">Room: <code>{roomName}</code></p>
                    )}
                </div>

                <div className="event-room-wrap">
                    {eventEnded ? (
                        <div className="event-ended">
                            <h2>This event has ended</h2>
                            <p>Thank you for attending. Recordings will be available shortly if enabled.</p>
                        </div>
                    ) : !isAuthenticated ? (
                        <div className="event-teaser">
                            <div className="event-teaser-icon">🎭</div>
                            <h2>Sign in to join the room</h2>
                            <p>
                                This is a live {eventTypeLabels[event.eventType]?.toLowerCase() ?? 'event'}.
                                Sign in to your AIM Studio account to access the live room.
                            </p>
                            <Link href="/login" className="event-teaser-btn">
                                Sign in to Join →
                            </Link>
                        </div>
                    ) : (
                        <RoomShell roomName={roomName} role={role} />
                    )}
                </div>
            </main>
        </>
    )
}
