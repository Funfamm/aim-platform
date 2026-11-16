'use client'

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { COLOR_DEFAULTS, optLabel, type Answers } from '@/lib/client-brief/schema'
import s from './preview.module.css'

/**
 * A live sketch of the client's future homepage, rebuilt from their answers.
 * Rendered at a fixed 1180px design width and scaled to fit its frame.
 */

const DESIGN_W = 1180

const NAV: Record<string, string> = {
    about: 'About', programs: 'Programs', camps: 'Camps', private: 'Training', tournaments: 'Tournaments', coaches: 'Coaches',
    schedule: 'Schedule', gallery: 'Gallery', news: 'News', shop: 'Shop', sponsors: 'Sponsors', alumni: 'Alumni', faq: 'FAQ',
    contact: 'Contact', join: 'Join us',
}
const CTA: Record<string, string> = {
    register: 'Register now', book: 'Book a session', trial: 'Book a free trial', contact: 'Contact us', shop: 'Shop now', sponsor: 'Partner with us',
}

/** Black or white, whichever reads better on the given hex color. */
export function inkFor(hex: string): string {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex)
    if (!m) return '#FFFFFF'
    const n = parseInt(m[1], 16)
    const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
    return L > 0.4 ? '#0A0A0A' : '#FFFFFF'
}

function initials(name: string) {
    const w = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
    if (!w.length) return 'FC'
    return (w.length === 1 ? w[0].slice(0, 2) : w.slice(0, 3).map(x => x[0]).join('')).toUpperCase()
}

const arr = (a: Answers, k: string) => (Array.isArray(a[k]) ? (a[k] as string[]) : [])
const str = (a: Answers, k: string) => (typeof a[k] === 'string' ? (a[k] as string) : '')

export default function SitePreview({ answers, compact = false }: { answers: Answers; compact?: boolean }) {
    const frameRef = useRef<HTMLDivElement>(null)
    const pageRef = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(0.4)
    const [pageH, setPageH] = useState(2000)
    const [flash, setFlash] = useState<string | null>(null)
    const prevFeatures = useRef<string[]>(arr(answers, 'features'))

    useLayoutEffect(() => {
        const frame = frameRef.current, page = pageRef.current
        if (!frame || !page) return
        const ro = new ResizeObserver(() => {
            setScale(frame.clientWidth / DESIGN_W)
            setPageH(page.offsetHeight)
        })
        ro.observe(frame); ro.observe(page)
        return () => ro.disconnect()
    }, [])

    // When a feature is ticked, scroll the sketch to its section and flash it.
    const features = arr(answers, 'features')
    const featureKey = features.join(',')
    useEffect(() => {
        const added = features.find(f => !prevFeatures.current.includes(f))
        prevFeatures.current = features
        if (!added) return
        const el = pageRef.current?.querySelector<HTMLElement>(`[data-f~="${added}"]`)
        const frame = frameRef.current
        if (el && frame) {
            frame.scrollTo({ top: Math.max(0, el.offsetTop * scale - 40), behavior: 'smooth' })
            setFlash(added)
            const t = setTimeout(() => setFlash(null), 1600)
            return () => clearTimeout(t)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [featureKey])

    const style = str(answers, 'style') || 'proclub'
    const club = str(answers, 'club') || 'Your Club'
    const location = str(answers, 'location') || 'New York'
    const primary = str(answers, 'color_primary') || COLOR_DEFAULTS.color_primary
    const secondary = str(answers, 'color_secondary') || COLOR_DEFAULTS.color_secondary
    const accent = str(answers, 'color_accent') || COLOR_DEFAULTS.color_accent
    const pages = arr(answers, 'pages')
    const has = (f: string) => features.includes(f)
    const navItems = (pages.length ? pages.filter(p => p !== 'home') : ['about', 'programs', 'camps', 'coaches', 'contact']).slice(0, 6).map(p => NAV[p] || p)
    const cta = CTA[str(answers, 'main_action')] || 'Get started'
    const ages = arr(answers, 'age_groups').map(a => optLabel('age_groups', a))
    const progLines = str(answers, 'programs').split('\n').map(l => l.replace(/[-–—:].*$/, '').trim()).filter(Boolean)
    const progN = Math.min(4, Math.max(3, parseInt(str(answers, 'program_pages'), 10) || 3))
    const programs = Array.from({ length: progN }, (_, i) => (progLines[i] || ['Academy Teams', 'Summer Camp', 'Private Training', 'Tournaments'][i]).slice(0, 26))
    const host = (() => { try { return new URL(str(answers, 'current_site') || 'https://yourclub.com').host.replace(/^www\./, '') } catch { return 'yourclub.com' } })()

    const vars = {
        '--pp': primary, '--pp-ink': inkFor(primary), '--ps': secondary, '--pa': accent, '--pa-ink': inkFor(accent),
    } as CSSProperties
    const on = (f: string) => `${s.sec} ${flash === f ? s.flash : ''}`

    return (
        <div className={`${s.browser} ${compact ? s.compact : ''}`}>
            <div className={s.chrome} aria-hidden="true">
                <i /><i /><i />
                <span className={s.url}>{host}</span>
            </div>
            <div ref={frameRef} className={s.frame} aria-label={`Live sketch of the ${club} homepage`} role="img">
                <div style={{ height: pageH * scale }}>
                    <div ref={pageRef} className={`${s.page} ${s['t_' + style] || ''}`} style={{ ...vars, width: DESIGN_W, transform: `scale(${scale})` }}>
                        {/* Nav */}
                        <header className={s.nav}>
                            <div className={s.logo}><span className={s.crest}>{initials(club)}</span><b>{club}</b></div>
                            <nav>{navItems.map(n => <span key={n}>{n}</span>)}</nav>
                            <div className={s.navEnd}>
                                {has('multilingual') && <span className={s.lang}>EN | ES</span>}
                                {has('portal') && <span className={s.login}>Parent login</span>}
                                <span className={s.btn}>{cta}</span>
                            </div>
                        </header>

                        {/* Hero */}
                        <section className={s.hero}>
                            <div className={s.heroCopy}>
                                {style === 'matchday' && <><p className={s.kicker}>{location} · Youth football</p><h1>{club}</h1><p className={s.tag}>Train. Compete. Rise.</p></>}
                                {style === 'academy' && <><p className={s.kicker}>{club}</p><h1>Nurturing young athletes into skilled leaders.</h1><p className={s.tag}>Elite coaching in {location} for ages {ages[0] || 'U6'} and up.</p></>}
                                {style === 'proclub' && <><p className={s.kicker}>Elite youth football · {location}</p><h1>{club}</h1><p className={s.tag}>The pathway from first touch to first team.</p></>}
                                {style === 'community' && <><p className={s.kicker}>Welcome to {club}</p><h1>Where every kid finds their game.</h1><p className={s.tag}>Friendly, expert coaching for the whole family.</p></>}
                                {style === 'street' && <><p className={s.kicker}>{club}</p><h1>Built in {location}.</h1><p className={s.tag}>No shortcuts. Just the work.</p></>}
                                {style === 'minimal' && <><p className={s.kicker}>{club}</p><h1>Football, done properly.</h1><p className={s.tag}>Coaching for ages {ages[0] || 'U6'} to {ages[ages.length - 1] || 'U19'} in {location}.</p></>}
                                <div className={s.heroBtns}><span className={s.btn}>{cta}</span><span className={s.ghost}>Explore programs</span></div>
                            </div>
                            <div className={s.photo} aria-hidden="true"><i className={s.ball} /></div>
                        </section>

                        {/* Programs + registration */}
                        <section className={on('registration') + ' ' + (flash === 'payments' ? s.flash : '')} data-f="registration payments payment_plans waivers">
                            <div className={s.secHead}><h2>Programs</h2>{ages.length > 0 && <div className={s.ages}>{ages.map(a => <span key={a}>{a}</span>)}</div>}</div>
                            <div className={s.cards}>
                                {programs.map((p, i) => (
                                    <div key={i} className={s.card}>
                                        <div className={s.cardImg} />
                                        <b>{p}</b>
                                        <small>{['Ages 6 to 18', 'July and August', '1-on-1 and small group', 'Spring and fall'][i]}</small>
                                        {(has('registration') || has('payments')) && <span className={s.btnSm}>{has('payments') ? 'Register and pay' : 'Register'}</span>}
                                    </div>
                                ))}
                            </div>
                            {has('waivers') && <p className={s.note}>Waivers and medical forms are signed online during registration.</p>}
                        </section>

                        {has('booking') && (
                            <section className={on('booking')} data-f="booking">
                                <div className={s.split}>
                                    <div><h2>Private training</h2><p className={s.body}>Pick a coach, pick a time, done.</p></div>
                                    <div className={s.slots}>{['Mon 4:00', 'Mon 5:30', 'Wed 4:00', 'Thu 6:00', 'Sat 9:00', 'Sat 10:30'].map(t => <span key={t}>{t}</span>)}</div>
                                </div>
                            </section>
                        )}

                        {(has('events') || has('calendar')) && (
                            <section className={`${on('events')} ${flash === 'calendar' ? s.flash : ''}`} data-f="events calendar">
                                <div className={s.secHead}><h2>{has('events') ? 'Upcoming events' : 'Training schedule'}</h2></div>
                                <div className={s.fixtures}>
                                    {[['SAT', '12', 'Open tryouts', 'All ages'], ['SUN', '20', 'Spring tournament', 'U9 to U15'], ['MON', '07', 'Summer camp, week 1', 'Ages 6 to 14']].map(r => (
                                        <div key={r[2]} className={s.fixture}><span className={s.date}><small>{r[0]}</small>{r[1]}</span><b>{r[2]}</b><span>{r[3]}</span>{has('events') && <span className={s.btnSm}>RSVP</span>}</div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {has('video') && (
                            <section className={on('video')} data-f="video">
                                <div className={s.video}><span className={s.play} /><b>Season highlights</b></div>
                            </section>
                        )}

                        {(has('player_profiles') || has('coach_tools') || has('portal') || has('reminders')) && (
                            <section className={`${s.sec} ${['player_profiles', 'coach_tools', 'portal', 'reminders'].includes(flash || '') ? s.flash : ''}`} data-f="player_profiles coach_tools portal reminders">
                                <div className={s.split}>
                                    <div><h2>Your player hub</h2><p className={s.body}>Schedules, payments{has('player_profiles') ? ', progress reports' : ''}{has('reminders') ? ' and reminders' : ''} in one place.</p></div>
                                    <div className={s.dash}><i /><i /><i /><i /></div>
                                </div>
                            </section>
                        )}

                        {(has('coach_bios') || has('alumni')) && (
                            <section className={`${on('coach_bios')} ${flash === 'alumni' ? s.flash : ''}`} data-f="coach_bios alumni">
                                <div className={s.secHead}><h2>{has('coach_bios') ? 'Meet the coaches' : 'Alumni'}</h2></div>
                                <div className={s.people}>{[0, 1, 2, 3].map(i => <div key={i}><i /><b>{has('coach_bios') ? ['Head Coach', 'Academy Director', 'Goalkeeping', 'Fitness'][i] : 'College commit'}</b></div>)}</div>
                            </section>
                        )}

                        {has('testimonials') && (
                            <section className={on('testimonials')} data-f="testimonials">
                                <blockquote className={s.quote}>“My son&apos;s confidence grew every single week.”<cite>Parent, U10</cite></blockquote>
                            </section>
                        )}

                        {(has('gallery') || has('instagram')) && (
                            <section className={`${on('gallery')} ${flash === 'instagram' ? s.flash : ''}`} data-f="gallery instagram">
                                <div className={s.secHead}><h2>{has('instagram') ? 'On Instagram' : 'Gallery'}</h2></div>
                                <div className={s.grid}>{[0, 1, 2, 3, 4, 5].map(i => <i key={i} />)}</div>
                            </section>
                        )}

                        {has('shop') && (
                            <section className={on('shop')} data-f="shop">
                                <div className={s.secHead}><h2>Club shop</h2></div>
                                <div className={s.cards}>{['Home jersey', 'Training top', 'Club scarf'].map(p => <div key={p} className={s.card}><div className={`${s.cardImg} ${s.kit}`} /><b>{p}</b><small>$45</small><span className={s.btnSm}>Add to cart</span></div>)}</div>
                            </section>
                        )}

                        {(has('sponsors') || has('donations')) && (
                            <section className={`${on('sponsors')} ${flash === 'donations' ? s.flash : ''}`} data-f="sponsors donations">
                                <div className={s.secHead}><h2>{has('sponsors') ? 'Our partners' : 'Scholarship fund'}</h2>{has('donations') && <span className={s.btn}>Donate</span>}</div>
                                {has('sponsors') && <div className={s.logos}>{[0, 1, 2, 3, 4].map(i => <i key={i}>Your logo</i>)}</div>}
                            </section>
                        )}

                        <footer className={`${s.footer} ${flash === 'newsletter' ? s.flash : ''}`} data-f="newsletter blog seo analytics">
                            <div><span className={s.crest}>{initials(club)}</span><b>{club}</b><small>{location}</small></div>
                            {has('newsletter') && <div className={s.sub}><span>Get club news</span><i /><span className={s.btnSm}>Subscribe</span></div>}
                            {has('blog') && <small>Latest news</small>}
                        </footer>

                        {has('trial_popup') && <div className={`${s.popup} ${flash === 'trial_popup' ? s.flash : ''}`} data-f="trial_popup"><b>Free trial session</b><small>Ages 6 to 18</small><span className={s.btnSm}>Book now</span></div>}
                        {has('ai_assistant') && <div className={`${s.chat} ${flash === 'ai_assistant' ? s.flash : ''}`} data-f="ai_assistant"><span>Hi! Ask me about camps, ages or prices.</span><i /></div>}
                    </div>
                </div>
            </div>
        </div>
    )
}
