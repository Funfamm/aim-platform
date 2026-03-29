import { notFound, redirect } from 'next/navigation'
import Footer from '@/components/Footer'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import ScriptSubmissionForm from '@/components/ScriptSubmissionForm'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const call = await prisma.scriptCall.findUnique({ where: { id } })
    if (!call) return { title: 'Not Found' }
    return {
        title: `${call.title} | Script Call | AIM Studio`,
        description: call.description.slice(0, 160),
    }
}

export default async function ScriptCallDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    const session = await getUserSession()
    if (!session) {
        redirect(`/login?redirect=/scripts/${id}`)
    }

    const call = await prisma.scriptCall.findUnique({
        where: { id },
        include: {
            project: { select: { title: true, slug: true, coverImage: true } },
            _count: { select: { submissions: true } },
        },
    })

    if (!call || !call.isPublic || call.status !== 'open') notFound()

    const toneList = call.toneKeywords?.split(',').map((t: string) => t.trim()).filter(Boolean) || []

    return (
        <>
<main style={{ minHeight: '100vh', paddingTop: '100px' }}>
                <section style={{ padding: 'var(--space-2xl) 0 var(--space-3xl)' }}>
                    <div className="container">
                        <div className="responsive-grid-1-1">
                            {/* Left — Call Details */}
                            <div>
                                {call.project && (
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                                        marginBottom: 'var(--space-lg)',
                                        fontSize: '0.7rem', color: 'var(--text-tertiary)',
                                        textTransform: 'uppercase', letterSpacing: '0.08em',
                                    }}>
                                        For project: <strong style={{ color: 'var(--accent-gold)' }}>{call.project.title}</strong>
                                    </div>
                                )}

                                <h1 style={{ marginBottom: 'var(--space-md)', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)' }}>
                                    {call.title}
                                </h1>
                                <div className="divider" />
                                <p style={{ fontSize: '1.05rem', lineHeight: 1.8, marginBottom: 'var(--space-xl)' }}>
                                    {call.description}
                                </p>

                                {/* Tags */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)', marginBottom: 'var(--space-xl)' }}>
                                    {call.genre && (
                                        <span style={{
                                            fontSize: '0.7rem', padding: '4px 12px',
                                            background: 'rgba(212,168,83,0.08)', color: 'var(--accent-gold)',
                                            borderRadius: 'var(--radius-full)', border: '1px solid rgba(212,168,83,0.15)',
                                        }}>🎬 {call.genre}</span>
                                    )}
                                    {call.targetLength && (
                                        <span style={{
                                            fontSize: '0.7rem', padding: '4px 12px',
                                            background: 'rgba(96,165,250,0.08)', color: '#60a5fa',
                                            borderRadius: 'var(--radius-full)', border: '1px solid rgba(96,165,250,0.15)',
                                        }}>⏱ {call.targetLength}</span>
                                    )}
                                    {call.deadline && (
                                        <span style={{
                                            fontSize: '0.7rem', padding: '4px 12px',
                                            background: 'rgba(244,63,94,0.08)', color: '#f43f5e',
                                            borderRadius: 'var(--radius-full)', border: '1px solid rgba(244,63,94,0.15)',
                                        }}>📅 Deadline: {call.deadline}</span>
                                    )}
                                </div>

                                {/* Tone */}
                                {toneList.length > 0 && (
                                    <div style={{ marginBottom: 'var(--space-xl)' }}>
                                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginBottom: 'var(--space-xs)' }}>
                                            Desired Tone
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {toneList.map((tone: string) => (
                                                <span key={tone} style={{
                                                    fontSize: '0.7rem', padding: '3px 10px',
                                                    background: 'rgba(255,255,255,0.03)',
                                                    borderRadius: 'var(--radius-full)',
                                                    border: '1px solid var(--border-subtle)',
                                                    color: 'var(--text-secondary)',
                                                }}>{tone}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Disclaimer */}
                                <div style={{
                                    padding: 'var(--space-lg)',
                                    background: 'rgba(212,168,83,0.04)',
                                    border: '1px solid rgba(212,168,83,0.12)',
                                    borderRadius: 'var(--radius-lg)',
                                }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-gold)', marginBottom: '6px' }}>
                                        📋 Submission Guidelines
                                    </div>
                                    <ul style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '16px', margin: 0 }}>
                                        <li>No financial compensation. This is a credit &amp; portfolio opportunity.</li>
                                        <li>Your script will be analyzed by our AI for production potential.</li>
                                        <li>The top 3 scripts will be reviewed by our creative team.</li>
                                        <li>Selected scripts may be adapted for AI-powered film production.</li>
                                        <li>You retain authorship credit on any produced work.</li>
                                    </ul>
                                </div>
                            </div>

                            {/* Right — Submission Form */}
                            <div>
                                <div className="glass-card" style={{
                                    padding: 'var(--space-xl)',
                                    border: '1px solid var(--border-accent)',
                                    position: 'sticky',
                                    top: '100px',
                                }}>
                                    <h3 style={{ color: 'var(--accent-gold)', marginBottom: 'var(--space-xs)', fontSize: '1.1rem' }}>
                                        ✍️ Submit Your Script
                                    </h3>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-lg)' }}>
                                        {call._count.submissions} submission{call._count.submissions !== 1 ? 's' : ''} received
                                    </p>
                                    <ScriptSubmissionForm callId={call.id} />
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    )
}
