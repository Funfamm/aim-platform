import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { sendTransactionalEmail } from '@/lib/email-router'
import { DEMO_TOKEN, sanitizeAnswers, summarize, type Answers } from '@/lib/client-brief/schema'

/**
 * Public client-brief API. The unguessable token in the URL is the only
 * credential, so the client needs no account.
 *   GET  → current answers + status
 *   PUT  → autosave answers; { submit: true } marks the brief submitted
 */

// Autosave fires roughly once per pause in typing; 40/min per IP is generous.
const briefLimiter = rateLimit({ interval: 60_000, limit: 40 })
const MAX_BODY = 100_000

const TOKEN_RE = /^[a-z0-9-]{4,64}$/

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
    const blocked = briefLimiter.check(request)
    if (blocked) return blocked
    const { token } = await params
    if (token === DEMO_TOKEN) return NextResponse.json({ demo: true, status: 'in_progress', answers: {} })
    if (!TOKEN_RE.test(token)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const brief = await prisma.clientBrief.findUnique({
        where: { token },
        select: { id: true, club: true, status: true, answers: true },
    })
    if (!brief) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    void prisma.clientBrief.update({ where: { id: brief.id }, data: { lastSeenAt: new Date() } }).catch(() => {})
    return NextResponse.json({ club: brief.club, status: brief.status, answers: brief.answers })
}

export async function PUT(request: Request, { params }: { params: Promise<{ token: string }> }) {
    const blocked = briefLimiter.check(request)
    if (blocked) return blocked
    const { token } = await params

    const raw = await request.text()
    if (raw.length > MAX_BODY) return NextResponse.json({ error: 'Too large' }, { status: 413 })
    let body: { answers?: unknown; submit?: unknown; _gotcha?: unknown }
    try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

    const answers = sanitizeAnswers(body.answers)
    const submit = body.submit === true

    if (token === DEMO_TOKEN) {
        return NextResponse.json({ ok: true, demo: true, status: submit ? 'submitted' : 'in_progress' })
    }
    if (!TOKEN_RE.test(token)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (body._gotcha) return NextResponse.json({ ok: true, status: 'in_progress' })

    const brief = await prisma.clientBrief.findUnique({ where: { token }, select: { id: true, club: true, status: true, submittedAt: true } })
    if (!brief) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    if (submit) {
        const name = typeof answers.contact_name === 'string' ? answers.contact_name : ''
        const email = typeof answers.email === 'string' ? answers.email : ''
        const phone = typeof answers.phone === 'string' ? answers.phone : ''
        if (!answers.club || !name || (!email && !phone)) {
            return NextResponse.json({ error: 'Please add your club name, your name, and an email or phone number.' }, { status: 400 })
        }
    }

    const str = (k: string) => (typeof answers[k] === 'string' ? (answers[k] as string) : null)
    const status = submit || brief.status === 'submitted' ? 'submitted' : 'in_progress'
    const now = new Date()
    await prisma.clientBrief.update({
        where: { id: brief.id },
        data: {
            answers,
            status,
            club: str('club') || brief.club,
            contactName: str('contact_name'),
            email: str('email'),
            phone: str('phone'),
            lastSeenAt: now,
            ...(submit ? { submittedAt: now } : {}),
        },
    })

    if (submit) void notifyAdmin(brief.id, answers, brief.status === 'submitted').catch(err => console.error('Brief notify failed:', err))
    return NextResponse.json({ ok: true, status })
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

async function notifyAdmin(id: string, a: Answers, isUpdate: boolean) {
    const settings = await prisma.siteSettings.findFirst({ select: { notifyEmail: true, contactEmail: true } })
    const to = settings?.notifyEmail || settings?.contactEmail
    if (!to) return
    const club = String(a.club || 'A client')
    const sections = summarize(a)
        .filter(s => s.rows.length)
        .map(s => `<h3 style="margin:24px 0 8px;font:700 13px/1 Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#17643A">${esc(s.title)}</h3>
            <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${s.rows.map(([q, v]) =>
                `<tr><td style="padding:6px 12px 6px 0;color:#667;font:14px Arial,sans-serif;vertical-align:top;width:40%">${esc(q)}</td><td style="padding:6px 0;font:14px Arial,sans-serif;color:#111;white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}</table>`)
        .join('')
    const html = `<div style="max-width:640px;margin:0 auto;padding:24px;background:#fff">
        <p style="font:700 12px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#888;margin:0">Client brief ${isUpdate ? 'updated' : 'submitted'}</p>
        <h1 style="font:800 28px Arial,sans-serif;margin:8px 0 4px;color:#111">${esc(club)}</h1>
        <p style="font:14px Arial,sans-serif;color:#444;margin:0 0 8px">Open it in your admin panel to see the quote: <a href="https://impactaistudio.com/admin/client-briefs?id=${encodeURIComponent(id)}">Client Briefs</a></p>
        ${sections}</div>`
    await sendTransactionalEmail({
        to,
        subject: `${isUpdate ? 'Updated' : 'New'} website brief: ${club}`,
        html,
        replyTo: typeof a.email === 'string' ? a.email : undefined,
        type: 'client_brief',
    })
}
