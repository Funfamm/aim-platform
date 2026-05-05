/**
 * AIM Platform — Presentation PPTX Generator
 * Run: node generate-pptx.mjs
 * Output: aim-platform-2026.pptx
 */
import PptxGenJS from 'pptxgenjs'

const pptx = new PptxGenJS()
pptx.author = 'Maxwell Onyeka'
pptx.title = 'AIM Platform — Project Presentation 2026'
pptx.subject = 'Software Engineering Capstone'
pptx.layout = 'LAYOUT_WIDE'

const BG = '0d0f14', GOLD = 'e4b95a', GOLD_DK = 'b8922e', TEXT = 'f3efe8', TEXT2 = 'b0a998', CARD = '181c28'
const H = { fontFace:'Georgia', color:GOLD, bold:true }
const B = { fontFace:'Calibri', color:TEXT }
const S = { fontFace:'Calibri', color:TEXT2 }

function slide(opts={}) {
    const s = pptx.addSlide(); s.background = { color:BG }
    if (opts.num) s.addText(opts.num, { x:11.5, y:0.3, w:1.5, h:0.6, ...H, fontSize:28, color:'1a1d26', align:'right' })
    if (opts.title) s.addText(opts.title, { x:0.7, y:0.4, w:10, h:0.7, ...H, fontSize:28 })
    return s
}

// 1 — Cover
const s1 = pptx.addSlide(); s1.background = { color:BG }
s1.addText('AIM STUDIO', { x:0, y:1.5, w:'100%', h:0.5, align:'center', ...S, fontSize:12, letterSpacing:8 })
s1.addText('AIM Platform', { x:0, y:2.2, w:'100%', h:1.2, align:'center', ...H, fontSize:48 })
s1.addText('Full-Stack Film Distribution & Community Platform', { x:0, y:3.5, w:'100%', h:0.5, align:'center', ...S, fontSize:16 })
s1.addText('Software Engineering Capstone — 2026', { x:0, y:4.3, w:'100%', h:0.4, align:'center', ...S, fontSize:13 })
s1.addText('Presented by Maxwell Onyeka', { x:0, y:4.8, w:'100%', h:0.4, align:'center', fontFace:'Georgia', color:GOLD, italic:true, fontSize:14 })
s1.addText("Don't look away.", { x:0, y:6.0, w:'100%', h:0.4, align:'center', fontFace:'Georgia', color:GOLD_DK, italic:true, fontSize:12 })

// 2 — Purpose
const s2 = slide({ num:'01', title:'Purpose of the Application' })
s2.addText([
    { text:'AIM Studio is an ', options:B },
    { text:'AI-powered cinema platform', options:{ ...B, color:GOLD, italic:true } },
    { text:' that produces emotional, character-driven films, casts community members into productions, and trains aspiring filmmakers in AI storytelling. We make films about ', options:B },
    { text:'sacrifice, regret, and the moments that matter', options:{ ...B, color:GOLD, italic:true } },
    { text:" — using AI not to replace cinema but to enable stories that wouldn't otherwise get told.", options:B },
], { x:0.7, y:1.5, w:11.5, h:2, fontSize:16, lineSpacingMultiple:1.6, valign:'top' })
s2.addText([
    { text:'The platform supports three audience pathways: ', options:B },
    { text:'watching', options:{ ...B, color:GOLD, italic:true } },
    { text:', ', options:B },
    { text:'auditioning', options:{ ...B, color:GOLD, italic:true } },
    { text:', and ', options:B },
    { text:'learning', options:{ ...B, color:GOLD, italic:true } },
    { text:' — each with its own infrastructure.', options:B },
], { x:0.7, y:3.8, w:11.5, h:1, fontSize:14, lineSpacingMultiple:1.5 })

// 3 — Tech
const s3 = slide({ num:'02', title:'Technologies Used' })
const TECH = [
    ['Framework','Next.js 15 + React 19'],['Language','TypeScript'],['Database','PostgreSQL (Neon) + Prisma ORM v6'],
    ['Authentication','JWT (JOSE) + Google OAuth 2.0 + bcrypt'],['Email — Transactional','Microsoft Graph + Gmail SMTP (Nodemailer)'],
    ['Email — Bulk','Azure Communication Services'],['Job Queue','BullMQ + Redis (Upstash)'],
    ['Object Storage','Cloudflare R2 (S3 SDK)'],['AI Scoring','Google Gemini 2.5 Flash'],
    ['Live Video','LiveKit (Watch Parties)'],['Internationalization','next-intl (EN/ES/FR/PT)'],
    ['Error Monitoring','Sentry'],['Rich Text','TipTap Editor'],['Animation','Framer Motion'],
    ['Deployment','Vercel (web) + PM2 (workers)'],
]
s3.addTable(TECH.map(([l,v])=>[
    { text:l, options:{ fontFace:'Calibri', color:GOLD, fontSize:11, bold:true } },
    { text:v, options:{ fontFace:'Calibri', color:TEXT, fontSize:11 } },
]), { x:0.7, y:1.4, w:11.5, border:{ type:'solid', pt:0.5, color:'2a2f3d' }, colW:[4,7.5], rowH:0.35, fill:{ color:CARD } })

// 4 — SysReq
const s4 = slide({ num:'03', title:'System Requirements' })
const SYSREQ = [
    ['Runtime','Node.js 20+'],['Database','PostgreSQL 15+ (Neon)'],['Cache/Queue','Redis (Upstash)'],
    ['Storage','S3-compatible (Cloudflare R2)'],['Email Trans.','Gmail SMTP / Graph API'],
    ['Email Bulk','Azure Communication Services'],['OAuth','Google Cloud OAuth 2.0'],
    ['Hosting','Vercel Pro (Edge + Cron)'],['Worker','PM2 on persistent server'],
    ['Browser','Chrome 110+, Safari 16+, Firefox 110+'],
]
const srRows = [[
    { text:'Category', options:{ fontFace:'Calibri', color:GOLD, fontSize:10, bold:true } },
    { text:'Requirement', options:{ fontFace:'Calibri', color:GOLD, fontSize:10, bold:true } },
], ...SYSREQ.map(([c,r])=>[
    { text:c, options:{ fontFace:'Calibri', color:GOLD, fontSize:11, italic:true } },
    { text:r, options:{ fontFace:'Calibri', color:TEXT, fontSize:11 } },
])]
s4.addTable(srRows, { x:0.7, y:1.4, w:11.5, border:{ type:'solid', pt:0.5, color:'2a2f3d' }, colW:[4,7.5], rowH:0.35, fill:{ color:CARD } })

// 5 — Phases
const s5 = slide({ num:'04', title:'Phases of Development' })
const PH = [
    ['1 — Foundational Architecture','Next.js, JWT+OAuth auth, 11-language support.'],
    ['2 — Content Management','Film models, admin TipTap workflows, AI casting scoring.'],
    ['3 — Audience Flows','Subscriber capture, Google OAuth, casting submissions to R2.'],
    ['4 — Email & Notifications','Multi-transport: Graph+ACS+SMTP. BullMQ priority queue.'],
    ['5 — Admin Tooling','Subscriber dashboard, bot cleanup, email analytics, approvals.'],
    ['6 — Operational Hardening','ACS webhooks, bounce analysis, suppression enforcement.'],
]
PH.forEach(([n,d],i)=>{
    const x=0.7+(i%2)*6.2, y=1.5+Math.floor(i/2)*1.6
    s5.addShape(pptx.ShapeType.roundRect, { x, y, w:5.8, h:1.3, fill:{ color:CARD }, line:{ color:'2a2f3d', width:0.5 }, rectRadius:0.1 })
    s5.addText(n, { x:x+0.2, y:y+0.15, w:5.4, h:0.35, ...H, fontSize:12 })
    s5.addText(d, { x:x+0.2, y:y+0.55, w:5.4, h:0.6, ...S, fontSize:10, lineSpacingMultiple:1.3 })
})

// 6-9 — Diagram description slides
const DIAGS = [
    ['05','UML Class Diagram','Key entities: User, Project, CastingCall, Application, Subscriber, EmailLog, EmailQueue, EmailSuppression, CtaConfiguration, NotificationSignup, Episode, FilmSubtitle. Relationships: User→Application, Project→CastingCall→Application, CtaConfiguration→NotificationSignup.'],
    ['06','Entity-Relationship Diagram','FK mapping: User 1:N Application, Project 1:N CastingCall (cascade), CastingCall 1:N Application, Project 1:N Episode, FilmSubtitle 1:N SubtitleRevision, CtaConfiguration 1:N NotificationSignup, Survey 1:N SurveyResponse, Course→Module→Lesson.'],
    ['07','Use Case Diagram','Four actors — Visitor: browse/subscribe/apply. Subscriber: receive notifications. Member: authenticate, watch, audition, manage account. Admin: manage content, approve subscribers, send announcements, view analytics, configure settings.'],
    ['08','Data Flow Diagram','(1) Subscribe: form→bot scoring→DB(active:false)→admin approve. (2) Register: form→DB→Gmail SMTP verification→confirm. (3) OAuth: Google→callback→JWT cookie. (4) Email: admin→queue→suppression check→ACS/SMTP→EmailLog→webhook→bounce tracking.'],
]
DIAGS.forEach(([num,title,note])=>{
    const sd = slide({ num, title })
    sd.addText('See HTML version for interactive Mermaid diagram', { x:0.7, y:1.3, w:11, h:0.4, ...S, fontSize:11, italic:true })
    sd.addShape(pptx.ShapeType.roundRect, { x:0.7, y:2.0, w:11.5, h:4, fill:{ color:CARD }, line:{ color:'2a2f3d', width:0.5 }, rectRadius:0.1 })
    sd.addText(note, { x:1, y:2.3, w:11, h:3.4, ...B, fontSize:13, lineSpacingMultiple:1.6, valign:'top' })
})

// 10 — Test Cases
const s10 = slide({ num:'09', title:'Test Case Grid' })
const TH = [
    { text:'ID', options:{ fontFace:'Calibri', color:GOLD, fontSize:8, bold:true } },
    { text:'Description', options:{ fontFace:'Calibri', color:GOLD, fontSize:8, bold:true } },
    { text:'Expected', options:{ fontFace:'Calibri', color:GOLD, fontSize:8, bold:true } },
    { text:'Status', options:{ fontFace:'Calibri', color:GOLD, fontSize:8, bold:true } },
]
const TD = [
    ['T01','Google sign-in (impactaistudio.com)','Authenticated, lands on dashboard','Pass'],
    ['T02','Google sign-in (www. redirect)','Auto-redirect, authenticated','Pass'],
    ['T03','Submit subscribe form','active=false, no email','Pass'],
    ['T04','Admin reviews subscribers','Bot scores visible','Pass'],
    ['T05','Bot Cleanup tool','Suspects flagged','Pass'],
    ['T06','Approve subscriber','active=true, no email','Pass'],
    ['T07','Email signup','Verification via Gmail SMTP','Pass'],
    ['T08','Verification link','Account active, welcome sent','Pass'],
    ['T09','Switch to Spanish','All pages in Spanish','Pass'],
    ['T10','Edit hero copy','Draft saved, preview works','Pass'],
    ['T11','Email Analytics','Health/bounce/send displayed','Pass'],
    ['T12','Bulk via ACS','Bounces via webhook','Pass'],
    ['T13','Graph tracking','NDR gap — ACS mitigates','Known'],
    ['T14','Translation review','Admin reviews pre-publish','Pass'],
    ['T15','Watch film','Video + episodes work','Pass'],
]
s10.addTable([TH, ...TD.map(([id,d,e,st])=>[
    { text:id, options:{ fontFace:'Calibri', color:GOLD, fontSize:8, bold:true } },
    { text:d, options:{ fontFace:'Calibri', color:TEXT, fontSize:8 } },
    { text:e, options:{ fontFace:'Calibri', color:TEXT, fontSize:8 } },
    { text:st, options:{ fontFace:'Calibri', color:st==='Pass'?'4ade80':st==='Known'?'fbbf24':'f87171', fontSize:8, bold:true } },
])], { x:0.4, y:1.3, w:12.2, border:{ type:'solid', pt:0.3, color:'2a2f3d' }, colW:[0.6,3.8,4.5,0.8], rowH:0.33, fill:{ color:CARD }, autoPage:true, autoPageRepeatHeader:true })

// 11 — Closing
const sE = pptx.addSlide(); sE.background = { color:BG }
sE.addText('AIM STUDIO', { x:0, y:2, w:'100%', h:0.5, align:'center', ...S, fontSize:12, letterSpacing:8 })
sE.addText("Don't look away.", { x:0, y:3, w:'100%', h:1, align:'center', fontFace:'Georgia', color:GOLD, italic:true, fontSize:36 })
sE.addText('Thank you.', { x:0, y:4.5, w:'100%', h:0.5, align:'center', ...S, fontSize:16 })

pptx.writeFile({ fileName:'aim-platform-2026.pptx' }).then(()=>console.log('✅ aim-platform-2026.pptx generated')).catch(e=>{console.error(e);process.exit(1)})
