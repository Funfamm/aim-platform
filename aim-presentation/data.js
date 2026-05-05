const TECH = [
    ['Framework', 'Next.js 15 + React 19'],
    ['Language', 'TypeScript'],
    ['Database', 'PostgreSQL (Neon) + Prisma ORM v6'],
    ['Authentication', 'JWT (JOSE) + Google OAuth 2.0 + bcrypt'],
    ['Email — Transactional', 'Microsoft Graph + Gmail SMTP (Nodemailer)'],
    ['Email — Bulk', 'Azure Communication Services'],
    ['Job Queue', 'BullMQ + Redis (Upstash)'],
    ['Object Storage', 'Cloudflare R2 (S3 SDK)'],
    ['AI Scoring', 'Google Gemini 2.5 Flash'],
    ['Live Video', 'LiveKit (Watch Parties)'],
    ['Internationalization', 'next-intl (EN / ES / FR / PT)'],
    ['Error Monitoring', 'Sentry'],
    ['Rich Text', 'TipTap Editor'],
    ['Animation', 'Framer Motion'],
    ['Deployment', 'Vercel (web) + PM2 (workers)'],
];

const SYSREQ = [
    ['Runtime', 'Node.js 20+'],
    ['Database', 'PostgreSQL 15+ (Neon cloud)'],
    ['Cache / Queue', 'Redis-compatible (Upstash)'],
    ['Object Storage', 'S3-compatible (Cloudflare R2)'],
    ['Email — Transactional', 'Gmail SMTP or Microsoft Graph API'],
    ['Email — Bulk', 'Azure Communication Services'],
    ['OAuth Provider', 'Google Cloud OAuth 2.0 credentials'],
    ['Hosting', 'Vercel Pro (Edge Functions + Cron)'],
    ['Worker Process', 'PM2 on persistent server'],
    ['Browser', 'Chrome 110+, Safari 16+, Firefox 110+'],
];

const PHASES = [
    [1, 'Foundational Architecture', 'Next.js application scaffolding, JWT + OAuth authentication system, and multi-language support across 11 languages with next-intl.'],
    [2, 'Content Management', 'Film and project models, admin editing workflows with rich text (TipTap), casting call infrastructure with AI-assisted application scoring.'],
    [3, 'Audience Flows', 'Subscriber capture with bot detection, account creation via Google OAuth and email verification, casting submissions with media upload to Cloudflare R2.'],
    [4, 'Email & Notification Infrastructure', 'Multi-transport email architecture: Microsoft Graph for transactional, Azure Communication Services for bulk, Gmail SMTP as fallback. Priority queue with BullMQ.'],
    [5, 'Admin Tooling', 'Subscriber management dashboard, bot scoring and cleanup workflows, email analytics with open/click/bounce tracking, manual approval gating.'],
    [6, 'Operational Hardening', 'Deliverability monitoring with ACS webhook integration, domain warm-up strategy, bounce visibility gap analysis, suppression engine with auto-threshold enforcement.'],
];

const TESTS = [
    ['T01', 'Sign in with Google from impactaistudio.com', 'User authenticated, lands on dashboard', 'As expected', 'Pass'],
    ['T02', 'Sign in with Google from www.impactaistudio.com', 'Auto-redirect to non-www, user authenticated', 'As expected', 'Pass'],
    ['T03', 'Submit subscribe form', 'Subscriber created with active=false, no email fired', 'As expected', 'Pass'],
    ['T04', 'Admin reviews pending subscribers', 'Bot scores and country flags visible in admin panel', 'As expected', 'Pass'],
    ['T05', 'Admin runs Bot Cleanup tool', 'Suspect subscribers identified with reason flags', 'As expected', 'Pass'],
    ['T06', 'Admin approves subscriber', 'active flips to true, no email fired', 'As expected', 'Pass'],
    ['T07', 'Create new account via email signup', 'Verification email arrives in inbox via Gmail SMTP', 'As expected', 'Pass'],
    ['T08', 'Click verification link', 'Account becomes active, welcome email sent', 'As expected', 'Pass'],
    ['T09', 'Switch site language to Spanish', 'All public pages render in Spanish', 'As expected', 'Pass'],
    ['T10', 'Admin edits homepage hero copy', 'Change saves to draft, preview before publish', 'As expected', 'Pass'],
    ['T11', 'View Email Analytics dashboard', 'Reputation health, bounce rate, send count display', 'As expected', 'Pass'],
    ['T12', 'Send bulk announcement via Azure ACS', 'Bounce events captured via Event Grid webhook', 'As expected', 'Pass'],
    ['T13', 'Microsoft Graph send tracking', 'NDR bounces captured in EmailLog', 'Graph NDR inbox poller deployed — bounces captured via cron polling', 'Pass'],
    ['T14', 'Translation review workflow', 'Admin reviews machine translations before publish', 'As expected', 'Pass'],
    ['T15', 'Watch a film as authenticated user', 'Video plays correctly with multi-episode navigation', 'As expected', 'Pass'],
];
