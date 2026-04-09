import PptxGenJS from 'pptxgenjs'
import fs from 'fs'

const pptx = new PptxGenJS()

// ── Theme colors ──
const C = {
    bg: '0A0A0F',
    bgCard: '111118',
    bgElevated: '16161F',
    gold: 'D4A853',
    goldDim: '2A2210',
    green: '34D399',
    greenDim: '0F2A20',
    blue: '60A5FA',
    blueDim: '101A2A',
    purple: 'A78BFA',
    red: 'F87171',
    amber: 'FBBF24',
    text: 'E8E8EC',
    textDim: '8B8B9E',
    textMuted: '4A4A5E',
    border: '1C1C28',
    white: 'FFFFFF',
    black: '000000',
}

pptx.layout = 'LAYOUT_WIDE'
pptx.author = 'AIM Studio'
pptx.subject = 'Sprint 4 Review'
pptx.title = 'AIM Studio Sprint 4: Media, Infrastructure & Global Reach'

// Define a dark master slide so every slide gets the dark background
pptx.defineSlideMaster({
    title: 'DARK_MASTER',
    background: { color: C.bg },
})


// ── Helpers ──
function goldTopBar(slide) {
    slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: '100%', h: 0.04,
        fill: { color: C.gold },
    })
}

function slideNumber(slide, num) {
    slide.addText(String(num).padStart(2, '0'), {
        x: 12.2, y: 6.85, w: 1, h: 0.3,
        fontSize: 10, color: C.textMuted, fontFace: 'Inter',
        align: 'right',
    })
}

function sectionLabel(slide, text, opts = {}) {
    slide.addText(text, {
        x: opts.x || 0.7, y: opts.y || 0.45, w: 6, h: 0.35,
        fontSize: 13, fontFace: 'Inter', bold: true, color: C.gold,
        charSpacing: 4,
    })
}

function heading(slide, text, italicText, opts = {}) {
    const parts = [{ text: text + ' ', options: { fontSize: 40, fontFace: 'Inter', bold: true, color: C.text } }]
    if (italicText) parts.push({ text: italicText, options: { fontSize: 40, fontFace: 'Georgia', italic: true, bold: true, color: C.gold } })
    slide.addText(parts, { x: opts.x || 0.7, y: opts.y || 0.85, w: 11, h: 0.8, lineSpacingMultiple: 1.0 })
}

function subtitle(slide, text, opts = {}) {
    slide.addText(text, {
        x: opts.x || 0.7, y: opts.y || 1.7, w: opts.w || 10, h: 0.7,
        fontSize: 15, fontFace: 'Inter', color: C.textDim, lineSpacingMultiple: 1.4,
    })
}

function statCard(slide, x, y, w, h, value, label, sub, color) {
    slide.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: C.bgCard }, rectRadius: 0.12, line: { color: C.border, width: 0.5 } })
    slide.addText(value, { x, y: y + 0.2, w, h: 0.6, fontSize: 42, fontFace: 'Inter', bold: true, color, align: 'center' })
    slide.addText(label, { x, y: y + 0.8, w, h: 0.25, fontSize: 11, fontFace: 'Inter', bold: true, color: C.textDim, align: 'center', charSpacing: 3 })
    if (sub) slide.addText(sub, { x, y: y + 1.08, w, h: 0.25, fontSize: 11, fontFace: 'Inter', color: C.textMuted, align: 'center' })
}

function featureCard(slide, x, y, w, h, icon, title, desc, accentColor) {
    slide.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: C.bgCard }, rectRadius: 0.12, line: { color: C.border, width: 0.5 } })
    if (accentColor) {
        slide.addShape(pptx.ShapeType.rect, { x, y, w: 0.05, h, fill: { color: accentColor }, rectRadius: 0.02 })
    }
    slide.addText(icon, { x: x + 0.2, y: y + 0.1, w: 0.5, h: 0.4, fontSize: 22 })
    slide.addText(title, { x: x + 0.2, y: y + 0.48, w: w - 0.4, h: 0.3, fontSize: 14, fontFace: 'Inter', bold: true, color: C.text })
    slide.addText(desc, { x: x + 0.2, y: y + 0.8, w: w - 0.4, h: h - 0.95, fontSize: 12, fontFace: 'Inter', color: C.textDim, lineSpacingMultiple: 1.35, valign: 'top' })
}

function checkList(slide, x, y, w, items) {
    items.forEach((item, i) => {
        slide.addText([
            { text: '✓  ', options: { color: C.green, bold: true, fontSize: 14 } },
            { text: item, options: { color: C.textDim, fontSize: 13 } },
        ], { x, y: y + i * 0.42, w, h: 0.38, fontFace: 'Inter', lineSpacingMultiple: 1.2 })
    })
}

// ══════════════════════════════════════════════
// SLIDE 1 Title
// ══════════════════════════════════════════════
{
    const s = pptx.addSlide({ masterName: 'DARK_MASTER' })
    goldTopBar(s)
    // Accent line
    s.addShape(pptx.ShapeType.rect, { x: 0.7, y: 0.8, w: 0.04, h: 1.8, fill: { color: C.gold } })
    // Brand
    s.addText('AIM STUDIO', { x: 0.95, y: 1.0, w: 4, h: 0.35, fontSize: 14, fontFace: 'Inter', bold: true, color: C.gold, charSpacing: 6 })
    // Title
    s.addText('Sprint 4', { x: 0.95, y: 1.5, w: 9, h: 0.9, fontSize: 60, fontFace: 'Inter', bold: true, color: C.text })
    s.addText('Media, Infrastructure & Global Reach', { x: 0.95, y: 2.35, w: 9, h: 0.65, fontSize: 34, fontFace: 'Georgia', italic: true, color: C.gold })
    // Divider
    s.addShape(pptx.ShapeType.rect, { x: 0.95, y: 3.25, w: 4, h: 0.03, fill: { color: C.gold } })
    // Meta
    s.addText('April 7, 2026  •  Sprint Review Presentation', { x: 0.95, y: 3.5, w: 7, h: 0.35, fontSize: 14, fontFace: 'Inter', color: C.textDim })
    s.addText('Content Modules → Production Infrastructure', { x: 0.95, y: 3.95, w: 7, h: 0.35, fontSize: 14, fontFace: 'Georgia', italic: true, color: C.gold })
    slideNumber(s, 1)
}

// ══════════════════════════════════════════════
// SLIDE 2 Sprint at a Glance
// ══════════════════════════════════════════════
{
    const s = pptx.addSlide({ masterName: 'DARK_MASTER' })
    goldTopBar(s)
    sectionLabel(s, '📊  SPRINT AT A GLANCE')
    heading(s, 'What', 'Sprint 4 Delivered')
    subtitle(s, 'Two weeks of infrastructure hardening, media pipeline engineering, and global localization preparing AIM Studio for real-world scale.')

    statCard(s, 0.7, 2.5, 2.6, 1.45, '264', 'COMMITS', 'Since Sprint 3 delivery', C.gold)
    statCard(s, 3.55, 2.5, 2.6, 1.45, '77K', 'LINES ADDED', '413 files changed', C.green)
    statCard(s, 6.4, 2.5, 2.6, 1.45, '42', 'DB MODELS', '298 source files', C.blue)
    statCard(s, 9.25, 2.5, 2.6, 1.45, '11', 'LANGUAGES', 'Full platform coverage', C.purple)

    // Summary strip
    const summaryItems = [
        '🚀 Render → Vercel migration',
        '🔐 15-min token rotation',
        '☁️ R2 presigned uploads',
        '✉️ Email tracking & analytics',
        '🤖 AI key pool management',
        '🌍 11-language i18n',
    ]
    summaryItems.forEach((item, i) => {
        const col = i % 3
        const row = Math.floor(i / 3)
        s.addText(item, {
            x: 0.7 + col * 3.6, y: 4.4 + row * 0.45, w: 3.4, h: 0.4,
            fontSize: 13, fontFace: 'Inter', color: C.textDim, bold: true,
        })
    })
    slideNumber(s, 2)
}

// ══════════════════════════════════════════════
// SLIDE 3 Render → Vercel
// ══════════════════════════════════════════════
{
    const s = pptx.addSlide({ masterName: 'DARK_MASTER' })
    goldTopBar(s)
    sectionLabel(s, '🚀  PLATFORM MIGRATION')
    heading(s, 'Render →', 'Vercel')
    subtitle(s, 'Migrated the entire deployment pipeline from Render to Vercel the native hosting platform for Next.js delivering faster builds, global edge CDN, and zero-config deployments.')

    // Before column
    s.addShape(pptx.ShapeType.rect, { x: 0.7, y: 2.4, w: 4.8, h: 3.5, fill: { color: C.bgCard }, rectRadius: 0.12, line: { color: C.border, width: 0.5 } })
    s.addText([
        { text: '🔴  ', options: { fontSize: 18 } },
        { text: 'Render (Before)', options: { fontSize: 16, fontFace: 'Inter', bold: true, color: C.textMuted } },
    ], { x: 1.0, y: 2.55, w: 4, h: 0.4 })
    const beforeItems = ['Custom Dockerfiles for Next.js', 'Single-region deployment (US-East)', 'Manual SSL & domain config', 'Build caching issues', '413 errors on media uploads', 'Cold starts on serverless functions']
    beforeItems.forEach((item, i) => {
        s.addText([
            { text: '✗  ', options: { color: C.red, bold: true, fontSize: 14 } },
            { text: item, options: { color: C.textDim, fontSize: 13 } },
        ], { x: 1.0, y: 3.1 + i * 0.42, w: 4.2, h: 0.38, fontFace: 'Inter' })
    })

    // Arrow
    s.addText('→', { x: 5.6, y: 3.6, w: 0.8, h: 0.5, fontSize: 28, color: C.gold, align: 'center', fontFace: 'Inter' })

    // After column
    s.addShape(pptx.ShapeType.rect, { x: 6.5, y: 2.4, w: 5.0, h: 3.5, fill: { color: C.bgCard }, rectRadius: 0.12, line: { color: '1A3A2A', width: 0.8 } })
    s.addText([
        { text: '🟢  ', options: { fontSize: 18 } },
        { text: 'Vercel (After)', options: { fontSize: 16, fontFace: 'Inter', bold: true, color: C.green } },
    ], { x: 6.8, y: 2.55, w: 4, h: 0.4 })
    const afterItems = ['Native Next.js framework detection', 'Global Edge Network (30+ regions)', 'Automatic SSL + custom domains', 'Incremental builds under 60s deploys', 'R2 presigned URLs bypass size limits', 'Zero cold starts with edge functions']
    afterItems.forEach((item, i) => {
        s.addText([
            { text: '✓  ', options: { color: C.green, bold: true, fontSize: 14 } },
            { text: item, options: { color: C.textDim, fontSize: 13 } },
        ], { x: 6.8, y: 3.1 + i * 0.42, w: 4.4, h: 0.38, fontFace: 'Inter' })
    })
    slideNumber(s, 3)
}

// ══════════════════════════════════════════════
// SLIDE 4 15-Minute Token Rotation
// ══════════════════════════════════════════════
{
    const s = pptx.addSlide({ masterName: 'DARK_MASTER' })
    goldTopBar(s)
    sectionLabel(s, '🔐  SECURITY ARCHITECTURE')
    heading(s, '15-Minute', 'Token Rotation')
    subtitle(s, 'Short-lived access tokens with automatic refresh every session token expires after 15 minutes and is silently rotated, preventing session hijacking and replay attacks.')

    // Flow diagram
    const nodes = [
        { x: 0.5, icon: '👤', name: 'User Login', sub: 'Credentials verified' },
        { x: 3.0, icon: '🎫', name: 'Access Token', sub: '15-min TTL', highlight: true },
        { x: 5.5, icon: '🔄', name: 'Refresh Token', sub: 'Long-lived, rotated' },
        { x: 8.0, icon: '✅', name: 'Silent Refresh', sub: 'Seamless to user', green: true },
    ]
    nodes.forEach(n => {
        const borderColor = n.highlight ? C.gold : n.green ? C.green : C.border
        s.addShape(pptx.ShapeType.rect, { x: n.x, y: 2.6, w: 2.2, h: 1.3, fill: { color: C.bgCard }, rectRadius: 0.1, line: { color: borderColor, width: 0.8 } })
        s.addText(n.icon, { x: n.x, y: 2.65, w: 2.2, h: 0.45, fontSize: 24, align: 'center' })
        s.addText(n.name, { x: n.x, y: 3.05, w: 2.2, h: 0.3, fontSize: 13, fontFace: 'Inter', bold: true, color: C.text, align: 'center' })
        s.addText(n.sub, { x: n.x, y: 3.35, w: 2.2, h: 0.25, fontSize: 11, fontFace: 'Inter', color: n.highlight ? C.gold : C.textMuted, align: 'center' })
    })
    // Arrows between nodes
    ;[2.7, 5.2, 7.7].forEach(x => {
        s.addText('→', { x, y: 2.95, w: 0.35, h: 0.5, fontSize: 22, color: C.gold, align: 'center' })
    })

    checkList(s, 0.7, 4.1, 11, [
        'Access tokens expire every 900 seconds cannot be reused after window closes',
        'Refresh endpoint (/api/auth/refresh) issues new pair without re-login',
        'Email verification tokens also expire at 15 minutes',
        'Tested with unit tests confirming exact 900-second TTL enforcement',
    ])
    slideNumber(s, 4)
}

// ══════════════════════════════════════════════
// SLIDE 5 Media Upload Pipeline
// ══════════════════════════════════════════════
{
    const s = pptx.addSlide({ masterName: 'DARK_MASTER' })
    goldTopBar(s)
    sectionLabel(s, '📦  MEDIA PIPELINE')
    heading(s, 'Client-Side', 'Direct Uploads')
    subtitle(s, 'Replaced the server-relay upload model with presigned URL uploads directly to Cloudflare R2 eliminating Vercel\'s 4.5MB serverless body limit and enabling large media file handling.')

    // Flow
    const uploadNodes = [
        { x: 0.3, icon: '📱', name: 'Client Browser', sub: 'Selects files' },
        { x: 2.9, icon: '🔑', name: 'API Route', sub: 'Generates presigned URL' },
        { x: 5.5, icon: '☁️', name: 'Cloudflare R2', sub: 'Direct PUT upload', highlight: true },
        { x: 8.1, icon: '🎬', name: 'CDN Delivery', sub: 'r2.impactaistudio.com', green: true },
    ]
    uploadNodes.forEach(n => {
        const borderColor = n.highlight ? C.gold : n.green ? C.green : C.border
        s.addShape(pptx.ShapeType.rect, { x: n.x, y: 2.5, w: 2.3, h: 1.1, fill: { color: C.bgCard }, rectRadius: 0.1, line: { color: borderColor, width: 0.8 } })
        s.addText(n.icon, { x: n.x, y: 2.55, w: 2.3, h: 0.4, fontSize: 20, align: 'center' })
        s.addText(n.name, { x: n.x, y: 2.9, w: 2.3, h: 0.25, fontSize: 9.5, fontFace: 'Inter', bold: true, color: C.text, align: 'center' })
        s.addText(n.sub, { x: n.x, y: 3.15, w: 2.3, h: 0.2, fontSize: 7.5, fontFace: 'Inter', color: n.highlight ? C.gold : C.textMuted, align: 'center' })
    })
    ;[2.55, 5.15, 7.75].forEach(x => {
        s.addText('→', { x, y: 2.75, w: 0.4, h: 0.4, fontSize: 18, color: C.gold, align: 'center' })
    })

    // Feature cards
    featureCard(s, 0.7, 4.0, 3.4, 1.5, '🚫', 'No 413 Errors', 'Server never touches file bytes presigned URL bypasses all body size limits.')
    featureCard(s, 4.35, 4.0, 3.4, 1.5, '📸', 'Casting Applications', 'Headshots, demos, portfolios uploaded directly from the casting form.')
    featureCard(s, 8.0, 4.0, 3.4, 1.5, '🔒', 'Secure by Design', 'Presigned URLs expire in 60 seconds. File type & size validated server-side.')
    slideNumber(s, 5)
}

// ══════════════════════════════════════════════
// SLIDE 6 Internationalization
// ══════════════════════════════════════════════
{
    const s = pptx.addSlide({ masterName: 'DARK_MASTER' })
    goldTopBar(s)
    sectionLabel(s, '🌍  INTERNATIONALIZATION')
    heading(s, '11 Languages,', 'Every Page')
    subtitle(s, 'Full i18n coverage across the entire platform using next-intl with a deep-merge locale loading strategy every page, form, notification, and email template is translated.')

    const langs = [
        { flag: '🇬🇧', name: 'English', sub: 'Primary' },
        { flag: '🇫🇷', name: 'Français', sub: 'French' },
        { flag: '🇪🇸', name: 'Español', sub: 'Spanish' },
        { flag: '🇩🇪', name: 'Deutsch', sub: 'German' },
        { flag: '🇵🇹', name: 'Português', sub: 'Portuguese' },
        { flag: '🇸🇦', name: 'العربية', sub: 'Arabic' },
        { flag: '🇮🇳', name: 'हिन्दी', sub: 'Hindi' },
        { flag: '🇨🇳', name: '中文', sub: 'Chinese' },
        { flag: '🇯🇵', name: '日本語', sub: 'Japanese' },
        { flag: '🇰🇷', name: '한국어', sub: 'Korean' },
        { flag: '🇷🇺', name: 'Русский', sub: 'Russian' },
    ]
    langs.forEach((lang, i) => {
        const col = i % 6
        const row = Math.floor(i / 6)
        const x = 0.7 + col * 1.85
        const y = 2.45 + row * 0.95
        s.addShape(pptx.ShapeType.rect, { x, y, w: 1.65, h: 0.8, fill: { color: C.bgCard }, rectRadius: 0.08, line: { color: C.border, width: 0.5 } })
        s.addText(lang.flag, { x, y: y + 0.05, w: 1.65, h: 0.3, fontSize: 16, align: 'center' })
        s.addText(lang.name, { x, y: y + 0.35, w: 1.65, h: 0.2, fontSize: 9, fontFace: 'Inter', bold: true, color: C.text, align: 'center' })
        s.addText(lang.sub, { x, y: y + 0.55, w: 1.65, h: 0.18, fontSize: 7, fontFace: 'Inter', color: C.textMuted, align: 'center' })
    })

    checkList(s, 0.7, 4.6, 11, [
        'Deep-merge strategy: page-level keys auto-merge with root translations no key collisions',
        'Scripts page, casting form, notification preferences, dashboard all fully translated',
        'Transactional emails render in the user\'s detected locale',
        'RTL support for Arabic layout',
    ])
    slideNumber(s, 6)
}

// ══════════════════════════════════════════════
// SLIDE 7 AI Infrastructure
// ══════════════════════════════════════════════
{
    const s = pptx.addSlide({ masterName: 'DARK_MASTER' })
    goldTopBar(s)
    sectionLabel(s, '🤖  AI INFRASTRUCTURE')
    heading(s, 'Intelligent', 'API Key Management')
    subtitle(s, 'Production-grade API key pool router with automatic error recovery, cooldown management, and real-time health monitoring.')

    featureCard(s, 0.7, 2.35, 5.2, 1.7, '🔄', 'Auto-Recovery Pool', 'Multiple Gemini keys rotate automatically. Rate-limited keys cool down for 65s, connection errors for 5 min then auto-rejoin the pool.')
    featureCard(s, 6.15, 2.35, 5.2, 1.7, '🚦', 'Health Status Badges', 'Live admin dashboard shows 🟢 Healthy, 🟡 Recovering, or 🔴 Cooling Down with countdown timers and error details.')
    featureCard(s, 0.7, 4.3, 5.2, 1.7, '🎯', 'Smart Routing', 'Keys assigned per-agent (audit, analytics, casting). Pool selects the least-recently-used healthy key automatically.')
    featureCard(s, 6.15, 4.3, 5.2, 1.7, '📊', 'AI Analytics Console', 'Voice-enabled AI insights with conversational follow-up. Generates 5-7 actionable recommendations from live platform data.')
    slideNumber(s, 7)
}

// ══════════════════════════════════════════════
// SLIDE 8 Email System
// ══════════════════════════════════════════════
{
    const s = pptx.addSlide({ masterName: 'DARK_MASTER' })
    goldTopBar(s)
    sectionLabel(s, '✉️  COMMUNICATIONS')
    heading(s, 'Email Delivery', 'Pipeline')
    subtitle(s, 'Dual-transport email system (Microsoft Graph + SMTP) with delivery logging, retry logic, and a full analytics panel.')

    statCard(s, 0.7, 2.5, 3.4, 1.3, 'Graph + SMTP', 'DUAL TRANSPORT', 'Configurable per admin settings', C.purple)
    statCard(s, 4.35, 2.5, 3.4, 1.3, '3x Retry', 'EXPONENTIAL BACKOFF', '1s → 2s → 4s automatic retries', C.green)
    statCard(s, 8.0, 2.5, 3.4, 1.3, '5 Types', 'AUTO-CATEGORIZED', 'Auth · App · Notify · Sub · General', C.blue)

    checkList(s, 0.7, 4.2, 11, [
        'Every outgoing email logged to EmailLog table recipient, subject, transport, success/failure',
        'Admin analytics panel: delivery rate badge, monthly volume, failure count, type breakdown chart',
        'Localized email templates Welcome, Verification, Application Status render in user\'s language',
    ])
    slideNumber(s, 8)
}

// ══════════════════════════════════════════════
// SLIDE 9 Admin Analytics Dashboard
// ══════════════════════════════════════════════
{
    const s = pptx.addSlide({ masterName: 'DARK_MASTER' })
    goldTopBar(s)
    sectionLabel(s, '📈  ANALYTICS & MONITORING')
    heading(s, 'Studio', 'Command Center')
    subtitle(s, 'Real-time admin analytics dashboard with live visitor tracking, AI-powered insights, voice conversation mode, casting funnel, and system health monitoring.')

    featureCard(s, 0.7, 2.35, 5.2, 1.7, '⚡', 'Real-Time Dashboard', 'Studio Pulse vitality score, live visitor count, page views, user growth, and casting conversion rates auto-refreshing every 30 seconds.')
    featureCard(s, 6.15, 2.35, 5.2, 1.7, '🎙️', 'Voice AI Insights', 'Generate AI-powered insights from live data. Voice conversation mode lets you ask follow-up questions with TTS responses.')
    featureCard(s, 0.7, 4.3, 5.2, 1.7, '🎯', 'Casting Funnel', 'Visual funnel: Page Views → Applications → Reviewed. Live conversion rate tracking shows casting page effectiveness.')
    featureCard(s, 6.15, 4.3, 5.2, 1.7, '🖥️', 'System Health', 'Database latency, memory usage, service status, hourly heatmaps, device breakdown, referrer sources full observability.')
    slideNumber(s, 9)
}

// ══════════════════════════════════════════════
// SLIDE 10 Live Demo Points
// ══════════════════════════════════════════════
{
    const s = pptx.addSlide({ masterName: 'DARK_MASTER' })
    goldTopBar(s)
    sectionLabel(s, '🎥  LIVE DEMO POINTS')
    heading(s, 'What I Can', 'Show You')
    subtitle(s, 'Every feature in this sprint is deployed and can be demonstrated live on the production platform.')

    // Public column
    s.addShape(pptx.ShapeType.rect, { x: 0.7, y: 2.5, w: 5.2, h: 3.3, fill: { color: C.bgCard }, rectRadius: 0.12, line: { color: C.border, width: 0.5 } })
    s.addText('🌐  Public-Facing', { x: 1.0, y: 2.65, w: 4.5, h: 0.35, fontSize: 15, fontFace: 'Inter', bold: true, color: C.gold })
    const publicItems = ['Switch language on any page all 11 render live', 'Submit a casting application with media uploads', 'PayPal donation flow sandbox or live', 'Scripts & Works page premium redesign', 'Google OAuth sign-in with token refresh']
    publicItems.forEach((item, i) => {
        s.addText([
            { text: '✓  ', options: { color: C.green, bold: true, fontSize: 14 } },
            { text: item, options: { color: C.textDim, fontSize: 13 } },
        ], { x: 1.0, y: 3.15 + i * 0.44, w: 4.6, h: 0.38, fontFace: 'Inter' })
    })

    // Admin column
    s.addShape(pptx.ShapeType.rect, { x: 6.15, y: 2.5, w: 5.2, h: 3.5, fill: { color: C.bgCard }, rectRadius: 0.12, line: { color: C.border, width: 0.5 } })
    s.addText('🔒  Admin Dashboard', { x: 6.45, y: 2.65, w: 4.5, h: 0.35, fontSize: 15, fontFace: 'Inter', bold: true, color: C.green })
    const adminItems = ['Analytics Command Center with live stats', 'AI Insights generation + voice mode', 'API key health badges (Healthy/Recovering/Cooling)', 'Email delivery panel volume, failures, types', 'Trailer & subscriber tracking cards']
    adminItems.forEach((item, i) => {
        s.addText([
            { text: '✓  ', options: { color: C.green, bold: true, fontSize: 14 } },
            { text: item, options: { color: C.textDim, fontSize: 13 } },
        ], { x: 6.45, y: 3.15 + i * 0.44, w: 4.6, h: 0.38, fontFace: 'Inter' })
    })
    slideNumber(s, 10)
}

// ══════════════════════════════════════════════
// SLIDE 11 Key Learnings
// ══════════════════════════════════════════════
{
    const s = pptx.addSlide({ masterName: 'DARK_MASTER' })
    goldTopBar(s)
    sectionLabel(s, '💡  REFLECTIONS')
    heading(s, 'What I', 'Learned')
    subtitle(s, 'Sprint 4 pushed into production infrastructure territory every challenge taught a principle I\'ll carry forward.')

    const learnings = [
        { icon: '🚀', title: 'Pick the Right Platform for Your Stack', desc: "Render is solid, but Next.js is a first-class citizen on Vercel native ISR, edge functions, preview deploys. Don't fight your framework.", color: C.gold },
        { icon: '🔐', title: 'Security Is Architecture, Not a Feature', desc: '15-min token rotation added complexity, but prevents session hijacking. Design security upfront, not as an afterthought.', color: C.green },
        { icon: '☁️', title: 'Never Relay Files Through Your Server', desc: 'Presigned URLs let the client upload directly to R2 storage shortest path for bytes eliminates size limits and latency.', color: C.blue },
        { icon: '🌍', title: 'i18n Must Be Structural, Not Cosmetic', desc: 'Deep-merge locale strategy prevents key collisions. Plan translation key structure before writing UI components.', color: C.purple },
        { icon: '📊', title: "If You Can't See It, You Can't Fix It", desc: 'Email logs, API key health badges, delivery rates observability isn\'t optional. Instrument everything from day one.', color: C.amber },
        { icon: '🗄️', title: 'Know Your ORM\'s Deployment Model', desc: 'prisma db push vs prisma migrate work differently in dev vs production. Understanding each prevents deployment failures.', color: C.red },
    ]
    learnings.forEach((l, i) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        featureCard(s, 0.7 + col * 5.45, 2.3 + row * 1.45, 5.2, 1.3, l.icon, l.title, l.desc, l.color)
    })
    slideNumber(s, 11)
}

// ══════════════════════════════════════════════
// SLIDE 12 Sprint 5 Roadmap
// ══════════════════════════════════════════════
{
    const s = pptx.addSlide({ masterName: 'DARK_MASTER' })
    goldTopBar(s)
    sectionLabel(s, "🗺️  SPRINT 5 ROADMAP WHAT'S NEXT")
    heading(s, 'Frontend Audit +', 'Bug Fixes')

    // Table
    const tableData = [
        [
            { text: 'Priority', options: { fontSize: 12, bold: true, color: C.gold, fill: { color: C.bgElevated }, align: 'center' } },
            { text: 'Feature', options: { fontSize: 12, bold: true, color: C.gold, fill: { color: C.bgElevated } } },
            { text: 'Description', options: { fontSize: 12, bold: true, color: C.gold, fill: { color: C.bgElevated } } },
        ],
        [
            { text: '🔴 HIGH', options: { fontSize: 11, color: C.red, align: 'center', fill: { color: C.bgCard } } },
            { text: 'Complete Frontend Audit', options: { fontSize: 13, bold: true, color: C.text, fill: { color: C.bgCard } } },
            { text: 'Page-by-page review of every route, form, and component across all 11 locales', options: { fontSize: 12, color: C.textDim, fill: { color: C.bgCard } } },
        ],
        [
            { text: '🔴 HIGH', options: { fontSize: 11, color: C.red, align: 'center', fill: { color: C.bg } } },
            { text: 'Bug Fixing & Regression', options: { fontSize: 13, bold: true, color: C.text, fill: { color: C.bg } } },
            { text: 'Resolve all UI/UX issues, broken flows, and edge cases found during audit', options: { fontSize: 12, color: C.textDim, fill: { color: C.bg } } },
        ],
        [
            { text: '🟡 MEDIUM', options: { fontSize: 11, color: C.amber, align: 'center', fill: { color: C.bgCard } } },
            { text: 'Performance Profiling', options: { fontSize: 13, bold: true, color: C.text, fill: { color: C.bgCard } } },
            { text: 'Lighthouse audits, Core Web Vitals, bundle size analysis, lazy loading', options: { fontSize: 12, color: C.textDim, fill: { color: C.bgCard } } },
        ],
        [
            { text: '🟡 MEDIUM', options: { fontSize: 11, color: C.amber, align: 'center', fill: { color: C.bg } } },
            { text: 'Cross-Browser Testing', options: { fontSize: 13, bold: true, color: C.text, fill: { color: C.bg } } },
            { text: 'Verify all features on Chrome, Safari, Firefox, and mobile browsers', options: { fontSize: 12, color: C.textDim, fill: { color: C.bg } } },
        ],
        [
            { text: '🔵 LOW', options: { fontSize: 11, color: C.blue, align: 'center', fill: { color: C.bgCard } } },
            { text: 'Domain Launch Prep', options: { fontSize: 13, bold: true, color: C.text, fill: { color: C.bgCard } } },
            { text: 'Final DNS setup, SEO meta tags, Open Graph images, production domain cutover', options: { fontSize: 12, color: C.textDim, fill: { color: C.bgCard } } },
        ],
    ]
    s.addTable(tableData, {
        x: 0.7, y: 1.85, w: 10.8,
        colW: [1.4, 2.8, 6.6],
        border: { type: 'solid', pt: 0.5, color: C.border },
        fontFace: 'Inter',
    })

    // Timeline
    const sprints = [
        { name: 'Sprint 1', label: 'Wireframes', done: true },
        { name: 'Sprint 2', label: 'Auth + Security', done: true },
        { name: 'Sprint 3', label: 'Content Modules', done: true },
        { name: 'Sprint 4', label: 'Media + Deploy', current: true },
        { name: 'Sprint 5', label: 'Audit + Fixes', future: true },
    ]
    sprints.forEach((sp, i) => {
        const x = 0.7 + i * 2.16
        const bg = sp.current ? C.goldDim : sp.done ? C.greenDim : C.bgCard
        const borderColor = sp.current ? C.gold : sp.done ? '1A3A2A' : C.border
        s.addShape(pptx.ShapeType.rect, { x, y: 5.3, w: 2.0, h: 1.0, fill: { color: bg }, rectRadius: 0.1, line: { color: borderColor, width: sp.current ? 1.2 : 0.5 } })
        s.addText(sp.name, { x, y: 5.38, w: 2.0, h: 0.4, fontSize: 14, fontFace: 'Inter', bold: true, color: sp.future ? C.textMuted : C.text, align: 'center' })
        s.addText(sp.label, { x, y: 5.75, w: 2.0, h: 0.3, fontSize: 11, fontFace: 'Inter', color: C.textDim, align: 'center' })
        if (sp.done || sp.current) s.addText('✅', { x: x + 1.55, y: 5.32, w: 0.3, h: 0.25, fontSize: 10 })
    })
    slideNumber(s, 12)
}

// ══════════════════════════════════════════════
// SLIDE 13 — Thank You
// ══════════════════════════════════════════════
{
    const s = pptx.addSlide({ masterName: 'DARK_MASTER' })
    goldTopBar(s)
    s.addText('🎬', { x: 0, y: 1.3, w: '100%', h: 0.8, fontSize: 52, align: 'center' })
    s.addText('AIM STUDIO', { x: 0, y: 2.2, w: '100%', h: 0.4, fontSize: 15, fontFace: 'Inter', bold: true, color: C.gold, align: 'center', charSpacing: 6 })
    s.addText('Thank You', { x: 0, y: 2.65, w: '100%', h: 0.85, fontSize: 54, fontFace: 'Inter', bold: true, color: C.text, align: 'center' })
    s.addShape(pptx.ShapeType.rect, { x: 4.5, y: 3.6, w: 4.2, h: 0.03, fill: { color: C.gold } })
    s.addText('Sprint 4 Media, Infrastructure & Global Reach', { x: 0, y: 3.8, w: '100%', h: 0.4, fontSize: 16, fontFace: 'Georgia', italic: true, color: C.gold, align: 'center' })
    s.addText('264 commits  ·  77K lines  ·  42 models  ·  11 languages', { x: 0, y: 4.3, w: '100%', h: 0.35, fontSize: 14, fontFace: 'Inter', color: C.textDim, align: 'center' })
    s.addText('impactaistudio.com', { x: 0, y: 4.9, w: '100%', h: 0.35, fontSize: 13, fontFace: 'Inter', color: C.textMuted, align: 'center' })
    slideNumber(s, 13)
}

// ── Export ──
const outPath = 'sprint4-v2.pptx'
pptx.writeFile({ fileName: outPath })
    .then(() => console.log(`✅ Created ${outPath}`))
    .catch(err => console.error('Failed:', err))
