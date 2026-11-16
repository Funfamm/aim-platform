/**
 * Client website brief — shared question schema, answer sanitizer and pricing.
 *
 * Used by the public brief page (/brief/[token]), its API, the admin
 * "Client Briefs" page and the submission email, so every surface agrees on
 * the same questions, labels and prices.
 */

export type Opt = [value: string, label: string, sub?: string]

export type Question =
    | { k: string; q: string; t: 'text' | 'email' | 'tel' | 'url' | 'date' | 'textarea' | 'number'; req?: boolean; ph?: string; hint?: string; max?: number }
    | { k: string; q: string; t: 'chips'; opts: Opt[]; single?: boolean; max?: number; hint?: string }
    | { k: string; q: string; t: 'radio' | 'cards'; opts: Opt[]; hint?: string }
    | { k: string; q: string; t: 'colors'; hint?: string }
    | { k: string; q: string; t: 'groups'; groups: [string, Opt[]][]; hint?: string }

export interface Step {
    id: string
    title: string
    minute: number // match minute shown in the progress bar
    lead: string
    qs: (Question | { pair: Question[] })[]
}

export const COLOR_KEYS = ['color_primary', 'color_secondary', 'color_accent'] as const
export const COLOR_DEFAULTS: Record<(typeof COLOR_KEYS)[number], string> = {
    color_primary: '#0B1F3A',
    color_secondary: '#FFFFFF',
    color_accent: '#E8B21E',
}

export const STEPS: Step[] = [
    {
        id: 'kickoff', title: 'Kickoff', minute: 0,
        lead: 'The basics, so we know exactly who we are building for.',
        qs: [
            { pair: [
                { k: 'club', q: 'Club or business name', t: 'text', req: true, ph: 'e.g. Dunamis FC' },
                { k: 'contact_name', q: 'Your name', t: 'text', req: true, ph: 'First and last name' },
            ] },
            { pair: [
                { k: 'role', q: 'Your role', t: 'text', ph: 'Founder, director, head coach…' },
                { k: 'location', q: 'Where you train', t: 'text', ph: 'Neighborhood or city' },
            ] },
            { pair: [
                { k: 'email', q: 'Email', t: 'email', ph: 'name@club.com' },
                { k: 'phone', q: 'Phone or WhatsApp', t: 'tel', ph: '+1 …' },
            ] },
            { k: 'current_site', q: 'Current website', t: 'url', ph: 'https://' },
            { k: 'age_groups', q: 'Age groups you coach', t: 'chips', opts: [['u8', 'U6 to U8'], ['u12', 'U9 to U12'], ['u15', 'U13 to U15'], ['u19', 'U16 to U19'], ['adult', 'Adults'], ['girls', "Girls' teams"]] },
            { k: 'players', q: 'Roughly how many players do you have?', t: 'chips', single: true, opts: [['lt50', 'Under 50'], ['50_150', '50 to 150'], ['150_400', '150 to 400'], ['gt400', '400+']] },
            { k: 'programs', q: 'List your programs', t: 'textarea', hint: 'Academy teams, camps, private training, tournaments, clinics. One per line, with prices if you are happy to share them.' },
        ],
    },
    {
        id: 'goals', title: 'Goals', minute: 12,
        lead: 'What should the new site actually do for the club?',
        qs: [
            { k: 'goals', q: 'Top goals for the new site', t: 'chips', max: 3, hint: 'Pick up to three.', opts: [
                ['registrations', 'More player registrations'], ['camps', 'Sell out camps and clinics'], ['trust', 'Look elite and trustworthy to parents'],
                ['sponsors', 'Attract sponsors'], ['scouts', 'Showcase players to scouts and colleges'], ['admin', 'Save admin time'],
                ['merch', 'Sell merchandise'], ['coaches', 'Recruit coaches and staff'], ['brand', 'Build our brand online']] },
            { k: 'main_action', q: 'The one thing a visitor should do first', t: 'radio', opts: [
                ['register', 'Register for a program'], ['book', 'Book a private session'], ['trial', 'Sign up for a free trial or tryout'],
                ['contact', 'Call or message us'], ['shop', 'Buy from the shop'], ['sponsor', 'Become a sponsor']] },
            { k: 'audience', q: 'Who visits the site?', t: 'chips', opts: [['parents', 'Parents'], ['players', 'Teen players'], ['adults', 'Adult players'], ['schools', 'Schools and partners'], ['sponsors', 'Sponsors and businesses'], ['scouts', 'Scouts and college coaches']] },
            { k: 'problems', q: 'What frustrates you about the current site?', t: 'textarea', hint: 'Anything at all: how it looks, what is missing, what is hard to update.' },
        ],
    },
    {
        id: 'look', title: 'Look & feel', minute: 25,
        lead: 'Pick the direction that feels most like you. Watch the preview change as you choose.',
        qs: [
            { k: 'style', q: 'Overall style', t: 'cards', opts: [
                ['matchday', 'Matchday', 'Bold, high energy, big type, stadium contrast'],
                ['academy', 'Elite academy', 'Clean and refined, like a top private school'],
                ['proclub', 'Pro club', 'Dark and cinematic, like a European club'],
                ['community', 'Community', 'Warm, photo-led, welcoming to families'],
                ['street', 'NYC street', 'Gritty, urban, poster-like'],
                ['minimal', 'Minimal', 'Simple, fast, lots of space']] },
            { k: 'brand_status', q: 'Your colors and logo', t: 'radio', opts: [
                ['keep', 'Keep our current colors and logo'], ['refresh', 'Refresh them: same spirit, sharper'], ['new', 'Start over with a new brand identity']] },
            { k: 'colors', q: 'Your team colors', t: 'colors', hint: 'Tap a color to change it. The preview updates instantly.' },
            { k: 'theme_pref', q: 'Light or dark?', t: 'chips', single: true, opts: [['light', 'Light'], ['dark', 'Dark'], ['both', 'Mix of both'], ['any', 'Up to you']] },
            { k: 'colors_avoid', q: 'Any colors to avoid?', t: 'text', ph: "e.g. no red, a rival club's color" },
            { k: 'logo', q: 'Your logo files', t: 'radio', opts: [
                ['vector', 'We have a high-quality logo file (AI, SVG, PDF or large PNG)'], ['lowres', 'We only have a small or blurry version'], ['need', 'We need a new logo']] },
            { k: 'inspiration', q: 'Websites you love', t: 'textarea', hint: 'Paste up to three links (any club, brand or sport) and tell us what you like about each.' },
        ],
    },
    {
        id: 'pages', title: 'Pages', minute: 38,
        lead: 'Which pages should the site have? Not sure? Tick what feels right and we will shape the structure.',
        qs: [
            { k: 'pages', q: 'Pages', t: 'chips', opts: [
                ['home', 'Home'], ['about', 'About and our story'], ['programs', 'Programs'], ['camps', 'Camps and clinics'], ['private', 'Private training'],
                ['tournaments', 'Tournaments'], ['coaches', 'Coaches and staff'], ['schedule', 'Schedule'], ['gallery', 'Gallery'], ['news', 'News and blog'],
                ['shop', 'Shop'], ['sponsors', 'Sponsors'], ['alumni', 'Alumni and success stories'], ['faq', 'FAQ'], ['contact', 'Contact'], ['join', 'Careers and volunteering']] },
            { k: 'program_pages', q: 'How many programs need their own page?', t: 'number', ph: 'e.g. 4', hint: 'One page per program lets parents see the ages, schedule and price.' },
            { k: 'extra_pages', q: 'Any other pages?', t: 'text', ph: 'e.g. Scholarship fund, Parent handbook' },
        ],
    },
    {
        id: 'features', title: 'Features', minute: 52,
        lead: 'What should the site be able to do? Tick everything you would like, even if it is for later.',
        qs: [
            { k: 'features', q: 'Features', t: 'groups', groups: [
                ['Registration and payments', [['registration', 'Online player registration'], ['payments', 'Pay fees and camps online'], ['payment_plans', 'Payment plans and monthly billing'], ['waivers', 'Digital waivers and medical forms']]],
                ['Scheduling', [['booking', 'Book private sessions online'], ['calendar', 'Training schedule calendar'], ['events', 'Tournaments and events with RSVP'], ['waitlists', 'Waitlists for full programs']]],
                ['Parents and players', [['portal', 'Parent and player accounts'], ['player_profiles', 'Player profiles and progress'], ['coach_tools', 'Coach dashboard'], ['reminders', 'Email and SMS reminders']]],
                ['Content', [['blog', 'News and blog'], ['gallery', 'Photo gallery'], ['video', 'Video hub for highlights and films'], ['testimonials', 'Parent testimonials'], ['coach_bios', 'Coach profiles'], ['alumni', 'Alumni and college commitments']]],
                ['Revenue', [['shop', 'Merch shop'], ['sponsors', 'Sponsor showcase and packages'], ['donations', 'Donations and scholarship fund']]],
                ['Growth', [['newsletter', 'Newsletter sign-up'], ['instagram', 'Live Instagram feed'], ['seo', 'Search setup so parents find you on Google'], ['analytics', 'Visitor analytics'], ['trial_popup', 'Free trial sign-up pop-up'], ['multilingual', 'Second language (e.g. Spanish)'], ['ai_assistant', "AI assistant that answers parents' questions"]]],
            ] },
            { k: 'tools_now', q: 'Tools you already use', t: 'text', ph: 'e.g. TeamSnap, LeagueApps, Stripe, Square, Mailchimp', hint: 'So we connect to them instead of replacing them.' },
        ],
    },
    {
        id: 'content', title: 'Content', minute: 66,
        lead: 'Words, photos and video are what make a site feel premium. Here is what we are working with.',
        qs: [
            { k: 'copy', q: 'Website text', t: 'radio', opts: [['ready', 'We will provide all the text'], ['polish', 'We have rough text, please polish it'], ['write', 'Please write it for us']] },
            { k: 'photos', q: 'Photos', t: 'radio', opts: [['pro', 'We have professional photos'], ['phone', 'We have phone photos'], ['shoot', 'We would like a professional photo shoot']] },
            { k: 'video', q: 'Video', t: 'radio', opts: [['have', 'We have video we can use'], ['promo', 'We would like a cinematic promo film for the homepage', 'AIM Studio is a film studio, so this is our specialty'], ['none', 'No video for now']] },
            { k: 'platform_now', q: 'Where is the current site built?', t: 'chips', single: true, opts: [['wix', 'Wix'], ['squarespace', 'Squarespace'], ['wordpress', 'WordPress'], ['godaddy', 'GoDaddy'], ['other', 'Other'], ['unknown', 'Not sure']] },
            { k: 'domain_access', q: 'Access to your domain', t: 'radio', opts: [['have', 'I have the login for the domain'], ['someone', 'Someone else manages it'], ['unknown', 'Not sure']] },
            { k: 'domain_email', q: 'Do you use email on the domain (e.g. info@yourclub.com)?', t: 'chips', single: true, opts: [['yes', 'Yes, keep it working'], ['no', 'No'], ['want', 'No, but we would like it']] },
        ],
    },
    {
        id: 'launch', title: 'Launch', minute: 80,
        lead: 'Timing and budget help us shape the right plan. A smaller first phase is always an option.',
        qs: [
            { pair: [
                { k: 'launch_date', q: 'Ideal launch date', t: 'date' },
                { k: 'key_date', q: 'Anything the site must be ready for?', t: 'text', ph: 'e.g. Summer camp sign-ups open' },
            ] },
            { k: 'budget', q: 'Budget range (USD)', t: 'radio', opts: [['b1', 'Under $3,000'], ['b2', '$3,000 to $6,000'], ['b3', '$6,000 to $12,000'], ['b4', '$12,000 to $25,000'], ['b5', '$25,000+'], ['talk', 'Not sure yet, let us talk']] },
            { k: 'care', q: 'After launch, who looks after the site?', t: 'radio', opts: [['self', 'We will update it ourselves (with training)'], ['managed', 'AIM Studio handles updates, security and changes each month'], ['unsure', 'Not sure yet']] },
            { k: 'decision', q: 'Who else needs to approve the design?', t: 'text', ph: 'e.g. Co-founder, board' },
            { k: 'notes', q: 'Anything else we should know?', t: 'textarea' },
        ],
    },
    { id: 'review', title: 'Full time', minute: 90, lead: 'Check your answers, then send them over. We will come back with a design direction and a quote.', qs: [] },
]

export const BUDGET: Record<string, [number, number]> = {
    b1: [0, 3000], b2: [3000, 6000], b3: [6000, 12000], b4: [12000, 25000], b5: [25000, Infinity],
}

/** Every question, flattened out of pairs. */
export function flatQuestions(): Question[] {
    return STEPS.flatMap(s => s.qs.flatMap(q => ('pair' in q ? q.pair : [q])))
}
const QMAP: Record<string, Question> = Object.fromEntries(flatQuestions().map(q => [q.k, q]))
export function question(k: string): Question | undefined { return QMAP[k] }

function allOpts(q: Question): Opt[] {
    if (q.t === 'groups') return q.groups.flatMap(([, items]) => items)
    if ('opts' in q) return q.opts
    return []
}
export function optLabel(k: string, v: string): string {
    const q = QMAP[k]
    if (!q) return v
    return allOpts(q).find(o => o[0] === v)?.[1] ?? v
}

export type Answers = Record<string, string | string[]>

/**
 * Keep only known keys and allowed values, and cap lengths. Anything a client
 * (or an attacker holding a token) sends passes through here before storage.
 */
export function sanitizeAnswers(input: unknown): Answers {
    const out: Answers = {}
    if (!input || typeof input !== 'object' || Array.isArray(input)) return out
    const src = input as Record<string, unknown>
    for (const q of flatQuestions()) {
        if (q.t === 'colors') {
            for (const ck of COLOR_KEYS) {
                const v = src[ck]
                if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)) out[ck] = v.toUpperCase()
            }
            continue
        }
        const v = src[q.k]
        const allowed = new Set(allOpts(q).map(o => o[0]))
        if (q.t === 'groups' || (q.t === 'chips' && !q.single)) {
            if (Array.isArray(v)) out[q.k] = [...new Set(v.filter((x): x is string => typeof x === 'string' && allowed.has(x)))]
        } else if (q.t === 'chips' || q.t === 'radio' || q.t === 'cards') {
            if (typeof v === 'string' && allowed.has(v)) out[q.k] = v
        } else if (typeof v === 'string') {
            const limit = q.t === 'textarea' ? 4000 : 300
            let s = v.trim().slice(0, limit)
            if (q.t === 'number') s = String(Math.max(0, Math.min(99, parseInt(s, 10) || 0)))
            if (q.t === 'date' && s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) s = ''
            if (s) out[q.k] = s
        }
    }
    const goals = out.goals
    if (Array.isArray(goals)) out.goals = goals.slice(0, 3)
    return out
}

/** Human-readable answer for one question, or "" when unanswered. */
export function answerText(k: string, a: Answers): string {
    const q = QMAP[k]
    if (q?.t === 'colors') {
        return COLOR_KEYS.map((ck, i) => (a[ck] ? `${['Main', 'Second', 'Accent'][i]} ${a[ck]}` : '')).filter(Boolean).join(', ')
    }
    const v = a[k]
    if (Array.isArray(v)) return v.map(x => optLabel(k, x)).join(', ')
    if (!v) return ''
    if (q && (q.t === 'radio' || q.t === 'chips' || q.t === 'cards')) return optLabel(k, v)
    if (q?.t === 'date') {
        const d = new Date(v + 'T12:00:00')
        return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    }
    return v
}

/** Answers grouped by step, unanswered questions dropped. */
export function summarize(a: Answers): { title: string; step: number; rows: [string, string][] }[] {
    return STEPS.filter(s => s.qs.length).map(s => ({
        title: s.title,
        step: STEPS.indexOf(s),
        rows: s.qs.flatMap(q => ('pair' in q ? q.pair : [q])).map(q => [q.q, answerText(q.k, a)] as [string, string]).filter(r => r[1]),
    }))
}

/* ── Pricing ─────────────────────────────────────────────────────────────── */

export interface Rates {
    base: number; included_pages: number; extra_page: number; program_page: number
    copy_polish_page: number; copy_write_page: number; photo_shoot: number; promo_film: number
    logo_design: number; brand_refresh: number; brand_identity: number
    rush_weeks: number; rush_pct: number; spread_pct: number; care_basic: number; care_managed: number
    features: Record<string, number>
}

export const RATE_LABELS: Record<Exclude<keyof Rates, 'features'>, string> = {
    base: 'Premium site build', included_pages: 'Pages included in build', extra_page: 'Each extra page', program_page: 'Each program page',
    copy_polish_page: 'Copy polish, per page', copy_write_page: 'Copywriting, per page', photo_shoot: 'Photo shoot', promo_film: 'Cinematic promo film',
    logo_design: 'New logo', brand_refresh: 'Brand refresh', brand_identity: 'New brand identity',
    rush_weeks: 'Rush if launch is under (weeks)', rush_pct: 'Rush surcharge %', spread_pct: 'Quote range spread %',
    care_basic: 'Basic care, per month', care_managed: 'Managed care, per month',
}

export const DEFAULT_RATES: Rates = {
    base: 3500, included_pages: 5, extra_page: 300, program_page: 200,
    copy_polish_page: 75, copy_write_page: 175, photo_shoot: 900, promo_film: 2500,
    logo_design: 1200, brand_refresh: 800, brand_identity: 2000,
    rush_weeks: 6, rush_pct: 25, spread_pct: 12, care_basic: 150, care_managed: 450,
    features: {
        registration: 900, payments: 800, payment_plans: 400, waivers: 500,
        booking: 900, calendar: 400, events: 600, waitlists: 300,
        portal: 3000, player_profiles: 1500, coach_tools: 1500, reminders: 700,
        blog: 400, gallery: 300, video: 500, testimonials: 200, coach_bios: 300, alumni: 300,
        shop: 1800, sponsors: 400, donations: 600,
        newsletter: 300, instagram: 250, seo: 800, analytics: 300, trial_popup: 300, multilingual: 1200, ai_assistant: 1500,
    },
}

/** Merge a stored rate card over the defaults, coercing everything to numbers >= 0. */
export function normalizeRates(input: unknown): Rates {
    const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
    const num = (v: unknown, d: number) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : d }
    const out = { ...DEFAULT_RATES, features: { ...DEFAULT_RATES.features } }
    for (const k of Object.keys(RATE_LABELS) as (keyof typeof RATE_LABELS)[]) out[k] = num(src[k], DEFAULT_RATES[k])
    const f = (src.features && typeof src.features === 'object' ? src.features : {}) as Record<string, unknown>
    for (const k of Object.keys(DEFAULT_RATES.features)) out.features[k] = num(f[k], DEFAULT_RATES.features[k])
    return out
}

export interface QuoteLine { group: string; label: string; amount: number }
export interface Quote {
    lines: QuoteLine[]; subtotal: number; rush: number; weeks: number | null
    total: number; low: number; high: number; monthly: number; fit: 'ok' | 'warn' | 'bad' | null
}

export function estimate(a: Answers, R: Rates, now = new Date()): Quote {
    const lines: QuoteLine[] = []
    const add = (group: string, label: string, amount: number) => { if (amount) lines.push({ group, label, amount }) }
    const arr = (k: string) => (Array.isArray(a[k]) ? (a[k] as string[]) : [])
    const pages = arr('pages')
    add('Build', `${RATE_LABELS.base} (up to ${R.included_pages} pages)`, R.base)
    const extra = Math.max(0, pages.length - R.included_pages)
    if (extra) add('Build', `${extra} extra page${extra > 1 ? 's' : ''}`, extra * R.extra_page)
    const progN = pages.includes('programs') ? Math.max(0, parseInt(String(a.program_pages || '0'), 10) || 0) : 0
    if (progN) add('Build', `${progN} program page${progN > 1 ? 's' : ''}`, progN * R.program_page)
    for (const f of arr('features')) add('Features', optLabel('features', f), R.features[f] ?? 0)
    const totalPages = Math.max(pages.length, 1) + progN
    if (a.copy === 'polish') add('Content', `Copy polish, ${totalPages} pages`, totalPages * R.copy_polish_page)
    if (a.copy === 'write') add('Content', `Copywriting, ${totalPages} pages`, totalPages * R.copy_write_page)
    if (a.photos === 'shoot') add('Content', RATE_LABELS.photo_shoot, R.photo_shoot)
    if (a.video === 'promo') add('Content', RATE_LABELS.promo_film, R.promo_film)
    if (a.brand_status === 'new') add('Brand', `${RATE_LABELS.brand_identity} (includes logo)`, R.brand_identity)
    else {
        if (a.brand_status === 'refresh') add('Brand', RATE_LABELS.brand_refresh, R.brand_refresh)
        if (a.logo === 'need') add('Brand', RATE_LABELS.logo_design, R.logo_design)
    }
    const subtotal = lines.reduce((s, l) => s + l.amount, 0)
    let rush = 0
    let weeks: number | null = null
    if (typeof a.launch_date === 'string' && a.launch_date) {
        weeks = (new Date(a.launch_date + 'T12:00:00').getTime() - now.getTime()) / 6048e5
        if (weeks < R.rush_weeks) rush = (subtotal * R.rush_pct) / 100
    }
    const total = subtotal + rush
    const sp = R.spread_pct / 100
    const monthly = a.care === 'managed' ? R.care_managed : R.care_basic
    const band = typeof a.budget === 'string' ? BUDGET[a.budget] : undefined
    const fit = band ? (total <= band[1] ? 'ok' : total <= band[1] * 1.25 ? 'warn' : 'bad') : null
    return { lines, subtotal, rush, weeks, total, low: total * (1 - sp), high: total * (1 + sp), monthly, fit }
}

export const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US')

/** Unguessable link token: readable club slug + 10 random base36 chars. */
export function makeToken(club: string): string {
    const slug = club.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'client'
    const bytes = new Uint8Array(10)
    crypto.getRandomValues(bytes)
    const rand = Array.from(bytes, b => (b % 36).toString(36)).join('')
    return `${slug}-${rand}`
}

export const DEMO_TOKEN = 'demo'
