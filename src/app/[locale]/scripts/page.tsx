import Link from 'next/link'
import Footer from '@/components/Footer'
import CinematicBackground from '@/components/CinematicBackground'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getLocale } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export const metadata = {
    title: 'Script Calls | AIM Studio',
    description: 'Submit your screenplay for a chance to have it produced by AIM Studio using AI-powered filmmaking.',
}

export default async function ScriptCallsPage() {
    // Require login to access scripts
    const session = await getUserSession()
    const locale = await getLocale()
    if (!session) redirect(`/${locale}/login`)

    let settings = null
    try { settings = await prisma.siteSettings.findFirst() } catch { /* schema drift — use defaults */ }
    const enabled = settings?.scriptCallsEnabled ?? false

    const calls = enabled ? await prisma.scriptCall.findMany({
        where: { isPublic: true, status: 'open' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
            project: { select: { title: true, coverImage: true } },
            _count: { select: { submissions: true } },
        },
    }) : []

    return (
        <>
<CinematicBackground variant="creative" />
            <main style={{ minHeight: '100vh', paddingTop: '100px', position: 'relative', zIndex: 2 }}>
                {/* Hero */}
                <section style={{
                    textAlign: 'center',
                    padding: 'var(--space-3xl) 0 var(--space-2xl)',
                }}>
                    <div className="container">
                        <span className="text-label">Open Calls</span>
                        <h1 style={{ marginTop: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                            Script <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--accent-gold)' }}>Submissions</span>
                        </h1>
                        <p style={{ maxWidth: '600px', margin: '0 auto', color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
                            We&apos;re looking for original screenplays. Submit your script and our AI will analyze it
                            for production potential. The best scripts get produced by AIM Studio.
                        </p>
                        <div style={{
                            marginTop: 'var(--space-lg)',
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            fontSize: '0.7rem', color: 'var(--text-tertiary)',
                            background: 'rgba(255,255,255,0.03)',
                            padding: '6px 16px',
                            borderRadius: 'var(--radius-full)',
                            border: '1px solid var(--border-subtle)',
                        }}>
                            ✍️ No financial compensation • Credit &amp; portfolio opportunity
                        </div>
                    </div>
                </section>

                {/* Calls List */}
                <section style={{ padding: '0 0 var(--space-3xl)' }}>
                    <div className="container">
                        {!enabled ? (
                            <div style={{
                                textAlign: 'center', padding: 'var(--space-3xl)',
                                color: 'var(--text-tertiary)',
                            }}>
                                <p style={{ fontSize: '1.2rem', marginBottom: 'var(--space-md)' }}>Script submissions are not currently open.</p>
                                <p>Check back soon for upcoming script calls.</p>
                            </div>
                        ) : calls.length === 0 ? (
                            <div style={{
                                textAlign: 'center', padding: 'var(--space-3xl)',
                                color: 'var(--text-tertiary)',
                            }}>
                                <p style={{ fontSize: '1.2rem', marginBottom: 'var(--space-md)' }}>No open script calls right now.</p>
                                <p>Check back soon or subscribe for updates.</p>
                            </div>
                        ) : (
                            <div className="grid-auto-fill">
                                {calls.map((call) => (
                                    <Link
                                        key={call.id}
                                        href={`/scripts/${call.id}`}
                                        className="glass-card"
                                        style={{
                                            display: 'block', padding: 'var(--space-xl)',
                                            textDecoration: 'none',
                                            transition: 'all 0.3s',
                                            border: '1px solid var(--border-subtle)',
                                        }}
                                    >
                                        {/* Project badge */}
                                        {call.project && (
                                            <div style={{
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                                marginBottom: 'var(--space-md)',
                                            }}>
                                                {call.project.coverImage && (
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '6px',
                                                        backgroundImage: `url(${call.project.coverImage})`,
                                                        backgroundSize: 'cover', backgroundPosition: 'center',
                                                        border: '1px solid var(--border-subtle)',
                                                    }} />
                                                )}
                                                <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                    For: {call.project.title}
                                                </span>
                                            </div>
                                        )}

                                        <h3 style={{ marginBottom: 'var(--space-sm)', fontSize: '1.2rem' }}>{call.title}</h3>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', lineHeight: 1.6 }}>
                                            {call.description.slice(0, 180)}{call.description.length > 180 ? '...' : ''}
                                        </p>

                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
                                            {call.genre && (
                                                <span style={{
                                                    fontSize: '0.65rem', padding: '3px 10px',
                                                    background: 'rgba(212,168,83,0.08)', color: 'var(--accent-gold)',
                                                    borderRadius: 'var(--radius-full)', border: '1px solid rgba(212,168,83,0.15)',
                                                }}>{call.genre}</span>
                                            )}
                                            {call.targetLength && (
                                                <span style={{
                                                    fontSize: '0.65rem', padding: '3px 10px',
                                                    background: 'rgba(96,165,250,0.08)', color: '#60a5fa',
                                                    borderRadius: 'var(--radius-full)', border: '1px solid rgba(96,165,250,0.15)',
                                                }}>{call.targetLength}</span>
                                            )}
                                            {call.deadline && (
                                                <span style={{
                                                    fontSize: '0.65rem', padding: '3px 10px',
                                                    background: 'rgba(255,255,255,0.03)', color: 'var(--text-tertiary)',
                                                    borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)',
                                                }}>Deadline: {call.deadline}</span>
                                            )}
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{
                                                fontSize: '0.7rem', color: 'var(--text-tertiary)',
                                            }}>
                                                {call._count.submissions} submission{call._count.submissions !== 1 ? 's' : ''}
                                            </span>
                                            <span className="btn btn-primary btn-sm">Submit Script →</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
