'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { COLOR_DEFAULTS, COLOR_KEYS, STEPS, summarize, type Answers, type Question } from '@/lib/client-brief/schema'
import SitePreview, { inkFor } from './SitePreview'
import s from './brief.module.css'

type Phase = 'cover' | 'flow' | 'done'
type Save = 'idle' | 'saving' | 'saved' | 'retry'

const PALETTES: [string, string, string, string][] = [
    ['Navy and gold', '#0B1F3A', '#FFFFFF', '#E8B21E'],
    ['Black and red', '#111111', '#FFFFFF', '#D7263D'],
    ['Royal blue', '#1846C2', '#FFFFFF', '#7FD4FF'],
    ['Forest and white', '#0F4D2E', '#FFFFFF', '#B9E769'],
    ['Purple and gold', '#3E1F73', '#FFFFFF', '#F2C14E'],
    ['Sky and navy', '#0E2240', '#E9F4FF', '#4FB3FF'],
]

function luminance(hex: string) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return 0
    const n = parseInt(m[1], 16)
    const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}

const str = (a: Answers, k: string) => (typeof a[k] === 'string' ? (a[k] as string) : '')
const list = (a: Answers, k: string) => (Array.isArray(a[k]) ? (a[k] as string[]) : [])

export default function BriefExperience({ token, club: initialClub, initialStatus, initialAnswers, demo, fontClass }: {
    token: string; club: string; initialStatus: string; initialAnswers: Answers; demo: boolean; fontClass: string
}) {
    const [phase, setPhase] = useState<Phase>(initialStatus === 'submitted' ? 'done' : 'cover')
    const [step, setStep] = useState(0)
    const [answers, setAnswers] = useState<Answers>(initialAnswers)
    const [status, setStatus] = useState(initialStatus)
    const [save, setSave] = useState<Save>('idle')
    const [kickErr, setKickErr] = useState(false)
    const [maxMsg, setMaxMsg] = useState(false)
    const [sheet, setSheet] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [submitErr, setSubmitErr] = useState('')
    const panelRef = useRef<HTMLDivElement>(null)

    const club = str(answers, 'club') || initialClub
    const returning = initialStatus === 'in_progress' && Object.keys(initialAnswers).length > 3

    /* ── colors: the whole interface takes on the club's accent ── */
    const theme = useMemo(() => {
        const cands = [str(answers, 'color_accent') || COLOR_DEFAULTS.color_accent, str(answers, 'color_secondary'), str(answers, 'color_primary')]
        const ui = cands.find(c => c && luminance(c) > 0.12) || '#E8B21E'
        return { '--club': ui, '--club-ink': inkFor(ui), '--club-2': str(answers, 'color_primary') || COLOR_DEFAULTS.color_primary } as CSSProperties
    }, [answers])

    /* ── autosave ── */
    const first = useRef(true)
    const latest = useRef(answers)
    latest.current = answers
    const put = useCallback(async (submit = false) => {
        const res = await fetch(`/api/brief/${token}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers: latest.current, submit }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Save failed')
        return data as { status: string }
    }, [token])

    useEffect(() => {
        if (first.current) { first.current = false; return }
        try { localStorage.setItem('aim-brief-' + token, JSON.stringify(answers)) } catch { /* private mode */ }
        setSave('saving')
        let retry: ReturnType<typeof setTimeout>
        const t = setTimeout(() => {
            put().then(() => setSave('saved')).catch(() => {
                setSave('retry')
                retry = setTimeout(() => put().then(() => setSave('saved')).catch(() => setSave('retry')), 5000)
            })
        }, 1100)
        return () => { clearTimeout(t); clearTimeout(retry) }
    }, [answers, put, token])

    /* ── answer setters ── */
    const set = (k: string, v: string | string[]) => setAnswers(a => ({ ...a, [k]: v }))
    const toggle = (k: string, v: string, max?: number) => setAnswers(a => {
        const cur = list(a, k)
        if (cur.includes(v)) { setMaxMsg(false); return { ...a, [k]: cur.filter(x => x !== v) } }
        if (max && cur.length >= max) { setMaxMsg(true); return a }
        return { ...a, [k]: [...cur, v] }
    })

    /* ── navigation ── */
    const kickoffOk = () => {
        const ok = !!(str(answers, 'club') && str(answers, 'contact_name') && (str(answers, 'email') || str(answers, 'phone')))
        setKickErr(!ok); return ok
    }
    const go = (i: number) => {
        if (step === 0 && i > 0 && !kickoffOk()) return
        setStep(Math.max(0, Math.min(STEPS.length - 1, i)))
        panelRef.current?.scrollTo({ top: 0 })
        window.scrollTo({ top: 0 })
    }
    const submit = async () => {
        if (!kickoffOk()) { setStep(0); return }
        setSubmitting(true); setSubmitErr('')
        try {
            const r = await put(true)
            setStatus(r.status || 'submitted'); setSave('saved'); setPhase('done'); window.scrollTo({ top: 0 })
        } catch (e) {
            setSubmitErr(e instanceof Error && e.message !== 'Save failed' ? e.message : 'We could not send your brief just now. Check your connection and try again.')
        } finally { setSubmitting(false) }
    }

    const cur = STEPS[step]
    const isReview = cur.id === 'review'

    return (
        <div className={`${s.root} ${phase === 'flow' ? s.app : ''} ${fontClass}`} style={theme}>
            {/* the site-wide bug-report widget doesn't belong on a client-facing brief */}
            <style>{'#sentry-feedback{display:none!important}'}</style>
            {phase === 'cover' && <Cover club={club} returning={returning} demo={demo} onStart={() => { setPhase('flow'); window.scrollTo({ top: 0 }) }} />}

            {phase === 'done' && <FullTime club={club} answers={answers} demo={demo} onEdit={() => { setPhase('flow'); setStep(STEPS.length - 1) }} />}

            {phase === 'flow' && (
                <>
                    <Scoreboard club={club} step={step} save={save} demo={demo} onJump={go} />
                    <main id="main-content" className={s.flow}>
                        <div className={s.panel} ref={panelRef}>
                            <header className={s.stepHead} key={cur.id}>
                                <span className={s.minute}>{cur.minute}&prime;</span>
                                <h1>{cur.title}</h1>
                                <p>{cur.lead}</p>
                            </header>

                            <div className={s.questions} key={cur.id + '-q'}>
                                {cur.qs.map((q, i) => 'pair' in q
                                    ? <div className={s.pair} key={i}>{q.pair.map(p => <Field key={p.k} q={p} a={answers} set={set} toggle={toggle} maxMsg={maxMsg} />)}</div>
                                    : <Field key={q.k} q={q} a={answers} set={set} toggle={toggle} maxMsg={maxMsg} />)}
                                {step === 0 && kickErr && <p className={s.err} role="alert">Add your club name, your name, and an email or phone number so we can reply.</p>}
                                {isReview && <Review answers={answers} onEdit={go} status={status} />}
                                {isReview && submitErr && <p className={s.err} role="alert">{submitErr}</p>}
                            </div>

                            <nav className={s.navBar} aria-label="Brief steps">
                                <button type="button" className={s.back} onClick={() => go(step - 1)} disabled={step === 0}>Back</button>
                                {isReview
                                    ? <button type="button" className={s.next} onClick={submit} disabled={submitting}>{submitting ? 'Sending…' : status === 'submitted' ? 'Send update' : 'Submit brief'}</button>
                                    : <button type="button" className={s.next} onClick={() => go(step + 1)}>{step === STEPS.length - 2 ? 'Review answers' : 'Next'} <span aria-hidden="true">→</span></button>}
                            </nav>
                        </div>

                        <aside className={s.stage} aria-label="Live preview">
                            <div className={s.stageGlow} aria-hidden="true" />
                            <div className={s.stageTop}><span className={s.live}><i />Live sketch</span><span>Updates as you answer</span></div>
                            <div className={s.stageFrame}><SitePreview answers={answers} /></div>
                            <p className={s.stageNote}>A quick sketch from your answers. Your real design will be crafted by hand.</p>
                        </aside>
                    </main>

                    <button type="button" className={s.fab} onClick={() => setSheet(true)}><i aria-hidden="true" />Preview your site</button>
                    {sheet && (
                        <div className={s.sheet} role="dialog" aria-modal="true" aria-label="Live preview" onClick={() => setSheet(false)}>
                            <div className={s.sheetInner} onClick={e => e.stopPropagation()}>
                                <div className={s.sheetHead}><span className={s.live}><i />Live sketch</span><button type="button" onClick={() => setSheet(false)}>Close</button></div>
                                <div className={s.sheetFrame}><SitePreview answers={answers} compact /></div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

/* ═══════════════════════════ Cover ═══════════════════════════ */

function Cover({ club, returning, demo, onStart }: { club: string; returning: boolean; demo: boolean; onStart: () => void }) {
    const long = club.length > 12
    return (
        <main id="main-content" className={s.cover}>
            <Stadium />
            <div className={s.coverTop}>
                <span className={s.wordmark}>AIM <b>Studio</b></span>
                <span className={s.private}>{demo ? 'Demo · not saved' : 'Private brief'}</span>
            </div>
            <div className={s.coverBody}>
                <p className={s.prepared}>Prepared for</p>
                <h1 className={`${s.club} ${long ? s.clubLong : ''}`} style={{ '--len': Math.max(4, ...club.split(/\s+/).map(w => w.length)) } as CSSProperties}>{club}</h1>
                <p className={s.coverLead}>Your new website starts here. Answer a few questions and watch it take shape, live, as you go.</p>
                <div className={s.coverCta}>
                    <button type="button" className={s.kickoff} onClick={onStart}>
                        <span className={s.kickBall} aria-hidden="true" />
                        {returning ? 'Continue where you left off' : 'Kick off'}
                    </button>
                    <span className={s.meta}>8 short sections · about 10 minutes · saves as you go</span>
                </div>
            </div>
            <div className={s.coverFoot} aria-hidden="true">
                <span>{club}</span><b>0 : 0</b><span>Kickoff 00&prime;</span>
            </div>
        </main>
    )
}

/** Night stadium: floodlight banks switch on, pitch lines chalk in, haze drifts. */
function Stadium() {
    const ref = useRef<HTMLCanvasElement>(null)
    useEffect(() => {
        const cv = ref.current
        if (!cv) return
        const ctx = cv.getContext('2d')
        if (!ctx) return
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        let W = 0, H = 0, raf = 0
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const motes = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random() * 0.7, r: Math.random() * 1.6 + 0.4, v: Math.random() * 0.00025 + 0.00008, a: Math.random() * 0.5 + 0.15 }))
        const resize = () => { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
        resize()
        window.addEventListener('resize', resize)
        const t0 = performance.now()

        // perspective helper: u ∈ [-1,1] across, d ∈ [0,1] far→near
        const P = (u: number, d: number) => {
            const farY = H * 0.6, nearY = H * 1.12
            const y = farY + (nearY - farY) * d * d * 0.55 + (nearY - farY) * d * 0.45
            const half = (W * 0.24) + (W * 0.72) * d
            return [W / 2 + u * half, y] as const
        }
        const line = (pts: (readonly [number, number])[], progress: number) => {
            const n = Math.max(2, Math.ceil(pts.length * progress))
            ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
            for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1])
            ctx.stroke()
        }
        const seg = (u0: number, d0: number, u1: number, d1: number, steps = 24) =>
            Array.from({ length: steps + 1 }, (_, i) => P(u0 + (u1 - u0) * (i / steps), d0 + (d1 - d0) * (i / steps)))
        const ellipse = (cu: number, cd: number, ru: number, rd: number) =>
            Array.from({ length: 65 }, (_, i) => { const t = (i / 64) * Math.PI * 2; return P(cu + Math.cos(t) * ru, cd + Math.sin(t) * rd) })

        const draw = (now: number) => {
            const t = reduce ? 99 : (now - t0) / 1000
            ctx.clearRect(0, 0, W, H)
            // sky
            const sky = ctx.createLinearGradient(0, 0, 0, H)
            sky.addColorStop(0, '#030507'); sky.addColorStop(0.55, '#06100C'); sky.addColorStop(1, '#0A1E14')
            ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H)

            // light banks switch on: left at 0.35s, right at 0.75s, with a flicker
            const bank = (start: number) => {
                if (t < start) return 0
                const k = t - start
                if (k < 0.25) return [0.9, 0.2, 1, 0.4, 1][Math.floor(k / 0.05)] ?? 1
                return Math.min(1, 0.85 + k * 0.6)
            }
            const L = bank(0.35), R = bank(0.75)
            const turfOn = Math.max(L, R)

            // turf with mowing stripes
            for (let i = 0; i < 12; i++) {
                const d0 = i / 12, d1 = (i + 1) / 12
                const a = P(-1, d0), b = P(1, d0), c = P(1, d1), e = P(-1, d1)
                ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(e[0], e[1]); ctx.closePath()
                ctx.fillStyle = i % 2 ? `rgba(28,96,52,${0.25 + 0.5 * turfOn})` : `rgba(22,80,43,${0.25 + 0.5 * turfOn})`
                ctx.fill()
            }

            // chalk lines draw in after the lights
            const chalk = reduce ? 1 : Math.min(1, Math.max(0, (t - 0.9) / 1.4))
            ctx.strokeStyle = `rgba(240,245,236,${0.35 + 0.35 * turfOn})`
            ctx.lineWidth = 2
            ctx.lineCap = 'round'
            if (chalk > 0) {
                line([...seg(-0.92, 0.02, 0.92, 0.02)], chalk)
                line(seg(-0.92, 0.02, -0.92, 1.2, 40), chalk)
                line(seg(0.92, 0.02, 0.92, 1.2, 40), chalk)
                line(seg(-0.92, 0.42, 0.92, 0.42), chalk)
                line(ellipse(0, 0.42, 0.2, 0.09), chalk)
                line([...seg(-0.42, 0.02, -0.42, 0.11, 6), ...seg(-0.42, 0.11, 0.42, 0.11, 18), ...seg(0.42, 0.11, 0.42, 0.02, 6)], chalk)
                line([...seg(-0.2, 0.02, -0.2, 0.05, 4), ...seg(-0.2, 0.05, 0.2, 0.05, 10), ...seg(0.2, 0.05, 0.2, 0.02, 4)], chalk)
            }

            // floodlight cones
            const cone = (x: number, inten: number, dir: number) => {
                if (inten <= 0) return
                const g = ctx.createRadialGradient(x, -H * 0.05, 0, x, -H * 0.05, H * 1.25)
                g.addColorStop(0, `rgba(255,236,190,${0.55 * inten})`)
                g.addColorStop(0.35, `rgba(255,236,190,${0.12 * inten})`)
                g.addColorStop(1, 'rgba(255,236,190,0)')
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g
                ctx.beginPath(); ctx.moveTo(x - 40 * dir, -H * 0.05); ctx.lineTo(x + W * 0.62 * dir, H * 1.1); ctx.lineTo(x + W * 0.05 * dir, H * 1.1); ctx.closePath(); ctx.fill()
                // the lamp bank itself
                for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
                    const lx = x - 26 * dir + i * 14 * dir, ly = H * 0.04 + j * 12
                    const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 22)
                    lg.addColorStop(0, `rgba(255,250,230,${inten})`); lg.addColorStop(1, 'rgba(255,240,200,0)')
                    ctx.fillStyle = lg; ctx.fillRect(lx - 22, ly - 22, 44, 44)
                }
                ctx.restore()
            }
            cone(W * 0.06, L, 1)
            cone(W * 0.94, R, -1)

            // haze motes drifting in the beams
            if (turfOn > 0) {
                for (const m of motes) {
                    if (!reduce) { m.x += m.v; if (m.x > 1.02) m.x = -0.02 }
                    ctx.fillStyle = `rgba(255,240,205,${m.a * turfOn})`
                    ctx.beginPath(); ctx.arc(m.x * W, m.y * H + Math.sin(now / 1800 + m.x * 9) * 6, m.r, 0, Math.PI * 2); ctx.fill()
                }
            }
            // vignette
            const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.2, W / 2, H * 0.55, Math.max(W, H) * 0.8)
            v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.7)')
            ctx.fillStyle = v; ctx.fillRect(0, 0, W, H)

            if (!reduce) raf = requestAnimationFrame(draw)
        }
        raf = requestAnimationFrame(draw)
        return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
    }, [])
    return <canvas ref={ref} className={s.stadium} aria-hidden="true" />
}

/* ═══════════════════════════ Scoreboard ═══════════════════════════ */

function Scoreboard({ club, step, save, demo, onJump }: { club: string; step: number; save: Save; demo: boolean; onJump: (i: number) => void }) {
    const target = STEPS[step].minute
    const [shown, setShown] = useState(target)
    const shownRef = useRef(target)
    useEffect(() => {
        const from = shownRef.current, t0 = performance.now()
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { shownRef.current = target; setShown(target); return }
        let raf = 0
        const tick = (now: number) => {
            const k = Math.min(1, (now - t0) / 700)
            const v = Math.round(from + (target - from) * (1 - (1 - k) ** 3))
            shownRef.current = v; setShown(v)
            if (k < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [target])
    const pct = (target / 90) * 100
    const saveText = demo ? 'Demo mode' : save === 'saving' ? 'Saving…' : save === 'saved' ? 'Saved' : save === 'retry' ? 'Not saved yet, retrying' : 'Saves as you go'
    return (
        <header className={s.board}>
            <div className={s.boardRow}>
                <span className={s.boardClub}>{club}</span>
                <span className={s.clock} aria-label={`Section ${step + 1} of ${STEPS.length}: ${STEPS[step].title}`}>
                    <b>{String(shown).padStart(2, '0')}&prime;</b><small>{STEPS[step].title}</small>
                </span>
                <span className={`${s.saveState} ${save === 'retry' ? s.saveWarn : ''}`} aria-live="polite">{save === 'saved' && <i aria-hidden="true" />}{saveText}</span>
            </div>
            <div className={s.track}>
                <div className={s.trackFill} style={{ width: pct + '%' }} />
                <span className={s.half} aria-hidden="true" />
                {STEPS.map((st, i) => (
                    <button key={st.id} type="button" className={`${s.tick} ${i <= step ? s.tickOn : ''}`} style={{ left: (st.minute / 90) * 100 + '%' }}
                        onClick={() => onJump(i)} aria-label={`Go to ${st.title}`} title={`${st.minute}′ ${st.title}`} />
                ))}
                <span className={s.trackBall} style={{ left: pct + '%' }} aria-hidden="true" />
            </div>
        </header>
    )
}

/* ═══════════════════════════ Fields ═══════════════════════════ */

function Field({ q, a, set, toggle, maxMsg }: {
    q: Question; a: Answers; set: (k: string, v: string | string[]) => void; toggle: (k: string, v: string, max?: number) => void; maxMsg: boolean
}) {
    const id = 'q-' + q.k
    const head = (
        <>
            <span className={s.qt} id={id + '-t'}>{q.q}{'req' in q && q.req && <span className={s.req} aria-hidden="true"> *</span>}</span>
            {q.hint && <span className={s.hint}>{q.hint}</span>}
        </>
    )
    switch (q.t) {
        case 'text': case 'email': case 'tel': case 'url': case 'date': case 'number':
            return (
                <label className={s.q} htmlFor={id}>{head}
                    <input id={id} type={q.t} className={s.input} value={str(a, q.k)} placeholder={q.ph} required={q.req}
                        inputMode={q.t === 'number' ? 'numeric' : undefined} min={q.t === 'number' ? 0 : undefined} max={q.t === 'number' ? 30 : undefined}
                        autoComplete={q.k === 'email' ? 'email' : q.k === 'phone' ? 'tel' : q.k === 'contact_name' ? 'name' : q.k === 'club' ? 'organization' : 'off'}
                        onChange={e => set(q.k, e.target.value)} />
                </label>
            )
        case 'textarea':
            return (
                <label className={s.q} htmlFor={id}>{head}
                    <textarea id={id} className={s.input} rows={4} value={str(a, q.k)} placeholder={q.ph} onChange={e => set(q.k, e.target.value)} />
                </label>
            )
        case 'chips': {
            const sel = q.single ? [str(a, q.k)] : list(a, q.k)
            return (
                <div className={s.q} role="group" aria-labelledby={id + '-t'}>{head}
                    <div className={s.chips}>
                        {q.opts.map(([v, l]) => (
                            <button key={v} type="button" className={`${s.chip} ${sel.includes(v) ? s.on : ''}`} aria-pressed={sel.includes(v)}
                                onClick={() => (q.single ? set(q.k, sel.includes(v) ? '' : v) : toggle(q.k, v, q.max))}>{l}</button>
                        ))}
                    </div>
                    {q.max && maxMsg && <span className={s.err}>You can pick up to {q.max}. Untick one to choose another.</span>}
                </div>
            )
        }
        case 'radio':
            return (
                <div className={s.q} role="radiogroup" aria-labelledby={id + '-t'}>{head}
                    <div className={s.opts}>
                        {q.opts.map(([v, l, sub]) => {
                            const on = str(a, q.k) === v
                            return (
                                <button key={v} type="button" role="radio" aria-checked={on} className={`${s.opt} ${on ? s.on : ''}`} onClick={() => set(q.k, on ? '' : v)}>
                                    <span className={s.dot} aria-hidden="true" /><span>{l}{sub && <small>{sub}</small>}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )
        case 'cards':
            return (
                <div className={s.q} role="radiogroup" aria-labelledby={id + '-t'}>{head}
                    <div className={s.cards}>
                        {q.opts.map(([v, l, sub]) => {
                            const on = str(a, q.k) === v
                            return (
                                <button key={v} type="button" role="radio" aria-checked={on} className={`${s.card} ${on ? s.on : ''}`} onClick={() => set(q.k, v)}>
                                    <span className={`${s.mini} ${s['m_' + v]}`} aria-hidden="true"><i /><i /><i /><i /></span>
                                    <b>{l}</b><small>{sub}</small>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )
        case 'colors':
            return (
                <div className={s.q} role="group" aria-labelledby={id + '-t'}>{head}
                    <div className={s.palettes}>
                        {PALETTES.map(([name, p, sc, ac]) => (
                            <button key={name} type="button" className={s.palette} onClick={() => { set('color_primary', p); set('color_secondary', sc); set('color_accent', ac) }}>
                                <span style={{ background: p }} /><span style={{ background: sc }} /><span style={{ background: ac }} />{name}
                            </button>
                        ))}
                    </div>
                    <div className={s.swatches}>
                        {COLOR_KEYS.map((ck, i) => {
                            const val = str(a, ck) || COLOR_DEFAULTS[ck]
                            return (
                                <label key={ck} className={s.swatch} htmlFor={'q-' + ck}>
                                    <input id={'q-' + ck} type="color" value={val} onChange={e => set(ck, e.target.value.toUpperCase())} />
                                    <span className={s.swatchChip} style={{ background: val }} />
                                    <span><b>{['Main', 'Second', 'Accent'][i]}</b><code>{val.toUpperCase()}</code></span>
                                </label>
                            )
                        })}
                    </div>
                </div>
            )
        case 'groups': {
            const sel = list(a, q.k)
            return (
                <div className={s.q} role="group" aria-labelledby={id + '-t'}>
                    <span className={s.qt} id={id + '-t'}>{q.q}<span className={s.count}>{sel.length} selected</span></span>
                    {q.groups.map(([g, items]) => (
                        <div key={g} className={s.group}>
                            <span className={s.groupName}>{g}</span>
                            <div className={s.chips}>
                                {items.map(([v, l]) => (
                                    <button key={v} type="button" className={`${s.chip} ${sel.includes(v) ? s.on : ''}`} aria-pressed={sel.includes(v)} onClick={() => toggle(q.k, v)}>{l}</button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )
        }
    }
}

/* ═══════════════════════════ Review & Full time ═══════════════════════════ */

function Review({ answers, onEdit, status }: { answers: Answers; onEdit: (i: number) => void; status: string }) {
    const secs = summarize(answers)
    return (
        <div className={s.review}>
            {status === 'submitted' && <p className={s.sentNote}>You already sent this brief. Change anything and press Send update.</p>}
            {secs.map(sec => (
                <section key={sec.title} className={s.revSec}>
                    <div className={s.revHead}><h2>{sec.title}</h2><button type="button" onClick={() => onEdit(sec.step)}>Edit</button></div>
                    {sec.rows.length
                        ? <dl>{sec.rows.map(([q, v]) => <div key={q}><dt>{q}</dt><dd>{v}</dd></div>)}</dl>
                        : <p className={s.hint}>Skipped</p>}
                </section>
            ))}
        </div>
    )
}

function FullTime({ club, answers, demo, onEdit }: { club: string; answers: Answers; demo: boolean; onEdit: () => void }) {
    const first = (str(answers, 'contact_name').split(' ')[0]) || 'there'
    const canvas = useRef<HTMLCanvasElement>(null)
    const goalRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        const cv = canvas.current
        if (!cv || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        const ctx = cv.getContext('2d'); if (!ctx) return
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const W = cv.clientWidth, H = cv.clientHeight
        cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        const colors = [str(answers, 'color_primary') || COLOR_DEFAULTS.color_primary, str(answers, 'color_secondary') || '#FFFFFF', str(answers, 'color_accent') || COLOR_DEFAULTS.color_accent, '#FFFFFF']
        // burst out of the net, not over the headline
        const g = goalRef.current?.getBoundingClientRect(), c = cv.getBoundingClientRect()
        const ox = g ? g.left - c.left + g.width / 2 : W / 2
        const oy = g ? g.top - c.top + g.height * 0.5 : H * 0.2
        const bits = Array.from({ length: 170 }, () => ({
            x: ox + (Math.random() - 0.5) * (g ? g.width * 0.6 : 120), y: oy, vx: (Math.random() - 0.5) * 18, vy: -Math.random() * 13 - 4,
            w: Math.random() * 8 + 5, h: Math.random() * 4 + 3, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: colors[Math.floor(Math.random() * colors.length)],
        }))
        let raf = 0
        const start = performance.now() + 1150 // burst as the ball hits the net
        const tick = (now: number) => {
            ctx.clearRect(0, 0, W, H)
            if (now >= start) {
                for (const b of bits) {
                    b.vy += 0.32; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr
                    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h); ctx.restore()
                }
            }
            if (now < start + 5000) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [answers])

    return (
        <main id="main-content" className={s.done}>
            <canvas ref={canvas} className={s.confetti} aria-hidden="true" />
            <div className={s.goal} ref={goalRef} aria-hidden="true">
                <svg viewBox="0 0 400 200" className={s.net}>
                    <defs>
                        <pattern id="mesh" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <path d="M0 0H14M0 0V14" stroke="rgba(255,255,255,.35)" strokeWidth="1.2" fill="none" />
                        </pattern>
                    </defs>
                    <rect x="20" y="20" width="360" height="170" fill="url(#mesh)" className={s.meshRect} />
                    <path d="M20 190V20H380V190" fill="none" stroke="#F4F6F1" strokeWidth="8" strokeLinejoin="round" />
                </svg>
                <span className={s.goalBall} />
            </div>
            <div className={s.doneBody}>
                <p className={s.prepared}>Full time · 90&prime;</p>
                <h1 className={s.doneTitle}>Brief received.</h1>
                <p className={s.coverLead}>Thank you, {first}. AIM Studio has everything we need to start designing the new {club} website.{demo ? ' (This was a demo, so nothing was saved.)' : ''}</p>
                <ol className={s.nextSteps}>
                    <li><b>We study your brief</b><span>Your goals, your style and every feature you picked.</span></li>
                    <li><b>You get a design direction and a quote</b><span>A first look at your new homepage, with a clear price.</span></li>
                    <li><b>We kick off together</b><span>A short call to agree the plan, then we start building.</span></li>
                </ol>
                <button type="button" className={s.back} onClick={onEdit}>Review or change my answers</button>
            </div>
        </main>
    )
}
