import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { notifyUser } from '@/lib/notifications'
import { announcementEmail } from '@/lib/email-templates'

// POST /api/livekit/rooms/share — send room invite via email + in-app notification
// Body: { eventId: string, target: 'all' | 'emails', emails?: string[] }

// ── Static translations ───────────────────────────────────────────────────────
// All 11 locales hardcoded as pure TypeScript — no runtime API call, no PowerShell.
const LOCALES = ['en', 'ar', 'de', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'ru', 'zh'] as const
type Locale = typeof LOCALES[number]

// Validate target at the type level
const VALID_TARGETS = ['all', 'emails', 'users'] as const
type ShareTarget = typeof VALID_TARGETS[number]

interface RoomInviteStrings {
    subject:      (title: string) => string
    notifTitle:   (title: string) => string
    notifMessage: (title: string, type: string) => string
    emailBody:    (title: string, type: string) => string
    badgeText:    string
    buttonText:   string
    footerOptIn:  string
    managePrefs:  string
}

const EVENT_TYPE_LABELS: Record<string, Record<Locale, string>> = {
    general:     { en:'Live Event',    ar:'حدث مباشر',            de:'Live-Event',       es:'Evento en vivo',      fr:'Événement en direct', hi:'लाइव इवेंट',  ja:'ライブイベント',      ko:'라이브 이벤트', pt:'Evento ao vivo',      ru:'Прямой эфир',        zh:'直播活动' },
    audition:    { en:'Live Audition', ar:'تصفية مباشرة',         de:'Live-Vorsprechen', es:'Audición en vivo',    fr:'Audition en direct',  hi:'लाइव ऑडिशन', ja:'ライブオーディション', ko:'라이브 오디션', pt:'Audição ao vivo',     ru:'Кастинг онлайн',     zh:'直播试镜' },
    q_and_a:     { en:'Live Q&A',      ar:'أسئلة وأجوبة مباشرة',  de:'Live-Q&A',         es:'Q&A en vivo',         fr:'Q&A en direct',       hi:'लाइव Q&A',    ja:'ライブQ&A',          ko:'라이브 Q&A',    pt:'Q&A ao vivo',         ru:'Q&A в прямом эфире', zh:'直播问答' },
    watch_party: { en:'Watch Party',   ar:'حفلة مشاهدة',          de:'Watch Party',      es:'Ver juntos',          fr:'Watch Party',         hi:'वॉच पार्टी',  ja:'ウォッチパーティー',  ko:'워치 파티',     pt:'Watch Party',         ru:'Совместный просмотр', zh:'共同观看' },
}

const INVITE_STRINGS: Record<Locale, RoomInviteStrings> = {
    en: {
        subject:      (t) => `🎬 You're invited: ${t} — Live on AIM Studio`,
        notifTitle:   (t) => `Join Now: ${t}`,
        notifMessage: (t, tp) => `You're invited to join "${t}" — a live ${tp} on AIM Studio. Tap to join.`,
        emailBody:    (t, tp) => `You have been invited to join <strong>${t}</strong>, a live ${tp} on AIM Studio. Click the button below to join the room now.`,
        badgeText: 'Live Event Invitation',
        buttonText: '▶ Join the Room Now →',
        footerOptIn: 'You received this invitation from the AIM Studio admin team.',
        managePrefs: 'Manage preferences',
    },
    ar: {
        subject:      (t) => `🎬 أنت مدعو: ${t} — مباشر على AIM Studio`,
        notifTitle:   (t) => `انضم الآن: ${t}`,
        notifMessage: (t, tp) => `تمت دعوتك للانضمام إلى "${t}" — ${tp} مباشر على AIM Studio. انقر للانضمام.`,
        emailBody:    (t, tp) => `لقد تمت دعوتك للانضمام إلى <strong>${t}</strong>، ${tp} مباشر على AIM Studio. انقر على الزر أدناه للانضمام الآن.`,
        badgeText: 'دعوة حدث مباشر',
        buttonText: '▶ انضم إلى الغرفة الآن ←',
        footerOptIn: 'تلقيت هذه الدعوة من فريق إدارة AIM Studio.',
        managePrefs: 'إدارة التفضيلات',
    },
    de: {
        subject:      (t) => `🎬 Sie sind eingeladen: ${t} — Live auf AIM Studio`,
        notifTitle:   (t) => `Jetzt beitreten: ${t}`,
        notifMessage: (t, tp) => `Sie sind eingeladen, an „${t}" teilzunehmen — ein ${tp} auf AIM Studio. Tippen Sie zum Beitreten.`,
        emailBody:    (t, tp) => `Sie wurden eingeladen, an <strong>${t}</strong>, einem Live-${tp} auf AIM Studio, teilzunehmen. Klicken Sie unten, um dem Raum jetzt beizutreten.`,
        badgeText: 'Live-Veranstaltungseinladung',
        buttonText: '▶ Jetzt dem Raum beitreten →',
        footerOptIn: 'Diese Einladung wurde vom AIM Studio Admin-Team gesendet.',
        managePrefs: 'Einstellungen verwalten',
    },
    es: {
        subject:      (t) => `🎬 Estás invitado: ${t} — En vivo en AIM Studio`,
        notifTitle:   (t) => `Únete ahora: ${t}`,
        notifMessage: (t, tp) => `Has sido invitado a unirte a "${t}" — un ${tp} en vivo en AIM Studio. Toca para unirte.`,
        emailBody:    (t, tp) => `Has sido invitado a unirte a <strong>${t}</strong>, un ${tp} en vivo en AIM Studio. Haz clic en el botón de abajo para unirte ahora.`,
        badgeText: 'Invitación a Evento en Vivo',
        buttonText: '▶ Unirse a la Sala Ahora →',
        footerOptIn: 'Recibiste esta invitación del equipo de administración de AIM Studio.',
        managePrefs: 'Gestionar preferencias',
    },
    fr: {
        subject:      (t) => `🎬 Vous êtes invité : ${t} — En direct sur AIM Studio`,
        notifTitle:   (t) => `Rejoindre maintenant : ${t}`,
        notifMessage: (t, tp) => `Vous êtes invité(e) à rejoindre "${t}" — un ${tp} en direct sur AIM Studio. Appuyez pour rejoindre.`,
        emailBody:    (t, tp) => `Vous avez été invité(e) à rejoindre <strong>${t}</strong>, un ${tp} en direct sur AIM Studio. Cliquez sur le bouton ci-dessous pour rejoindre maintenant.`,
        badgeText: "Invitation à un événement en direct",
        buttonText: '▶ Rejoindre la salle maintenant →',
        footerOptIn: "Vous avez reçu cette invitation de l'équipe administrateur d'AIM Studio.",
        managePrefs: 'Gérer les préférences',
    },
    hi: {
        subject:      (t) => `🎬 आपको आमंत्रित किया गया है: ${t} — AIM Studio पर लाइव`,
        notifTitle:   (t) => `अभी जुड़ें: ${t}`,
        notifMessage: (t, tp) => `आपको "${t}" — AIM Studio पर एक लाइव ${tp} में शामिल होने के लिए आमंत्रित किया गया है। जुड़ने के लिए टैप करें।`,
        emailBody:    (t, tp) => `आपको AIM Studio पर एक लाइव ${tp} <strong>${t}</strong> में शामिल होने के लिए आमंत्रित किया गया है। अभी कमरे में शामिल होने के लिए नीचे दिए गए बटन पर क्लिक करें।`,
        badgeText: 'लाइव इवेंट निमंत्रण',
        buttonText: '▶ अभी कमरे में शामिल हों →',
        footerOptIn: 'यह निमंत्रण AIM Studio व्यवस्थापक टीम द्वारा भेजा गया है।',
        managePrefs: 'प्राथमिकताएं प्रबंधित करें',
    },
    ja: {
        subject:      (t) => `🎬 招待状: ${t} — AIM Studio ライブ`,
        notifTitle:   (t) => `今すぐ参加: ${t}`,
        notifMessage: (t, tp) => `「${t}」— AIM Studio のライブ${tp}にご招待します。タップして参加してください。`,
        emailBody:    (t, tp) => `AIM Studio のライブ${tp} <strong>${t}</strong> にご招待します。下のボタンをクリックして今すぐルームに参加してください。`,
        badgeText: 'ライブイベント招待',
        buttonText: '▶ 今すぐルームに参加 →',
        footerOptIn: 'この招待はAIM Studioの管理チームから送信されました。',
        managePrefs: '設定を管理',
    },
    ko: {
        subject:      (t) => `🎬 초대장: ${t} — AIM Studio 라이브`,
        notifTitle:   (t) => `지금 참여: ${t}`,
        notifMessage: (t, tp) => `"${t}" — AIM Studio 라이브 ${tp}에 참여하도록 초대되었습니다. 탭하여 참여하세요.`,
        emailBody:    (t, tp) => `AIM Studio의 라이브 ${tp} <strong>${t}</strong>에 참여하도록 초대받았습니다. 아래 버튼을 클릭하여 지금 룸에 참여하세요.`,
        badgeText: '라이브 이벤트 초대',
        buttonText: '▶ 지금 룸 참여하기 →',
        footerOptIn: '이 초대장은 AIM Studio 관리팀에서 보냈습니다.',
        managePrefs: '환경설정 관리',
    },
    pt: {
        subject:      (t) => `🎬 Você está convidado: ${t} — Ao vivo no AIM Studio`,
        notifTitle:   (t) => `Participar agora: ${t}`,
        notifMessage: (t, tp) => `Você foi convidado para participar de "${t}" — um ${tp} ao vivo no AIM Studio. Toque para participar.`,
        emailBody:    (t, tp) => `Você foi convidado para participar de <strong>${t}</strong>, um ${tp} ao vivo no AIM Studio. Clique no botão abaixo para entrar na sala agora.`,
        badgeText: 'Convite para Evento ao Vivo',
        buttonText: '▶ Entrar na Sala Agora →',
        footerOptIn: 'Você recebeu este convite da equipe de administração do AIM Studio.',
        managePrefs: 'Gerenciar preferências',
    },
    ru: {
        subject:      (t) => `🎬 Вас приглашают: ${t} — Прямой эфир на AIM Studio`,
        notifTitle:   (t) => `Присоединиться: ${t}`,
        notifMessage: (t, tp) => `Вас приглашают присоединиться к «${t}» — ${tp} в прямом эфире на AIM Studio. Нажмите, чтобы войти.`,
        emailBody:    (t, tp) => `Вас приглашают присоединиться к <strong>${t}</strong> — ${tp} в прямом эфире на AIM Studio. Нажмите кнопку ниже, чтобы войти в комнату прямо сейчас.`,
        badgeText: 'Приглашение на прямой эфир',
        buttonText: '▶ Войти в комнату сейчас →',
        footerOptIn: 'Это приглашение отправлено командой администраторов AIM Studio.',
        managePrefs: 'Управление настройками',
    },
    zh: {
        subject:      (t) => `🎬 您受邀参加: ${t} — AIM Studio 直播`,
        notifTitle:   (t) => `立即加入: ${t}`,
        notifMessage: (t, tp) => `您受邀参加"${t}"— AIM Studio上的直播${tp}。点击加入。`,
        emailBody:    (t, tp) => `您受邀参加AIM Studio上的直播${tp} <strong>${t}</strong>。点击下方按钮立即加入房间。`,
        badgeText: '直播活动邀请',
        buttonText: '▶ 立即加入房间 →',
        footerOptIn: '此邀请由AIM Studio管理团队发送。',
        managePrefs: '管理偏好设置',
    },
}

// ── Simple in-process rate limiter (per-admin, per-event) ─────────────────────
// Prevents accidental double-sends or quota exhaustion.
// 3 shares per admin per event per minute is generous for legitimate use.
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT     = 3
const rateLimitMap   = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(adminId: string, eventId: string): boolean {
    const key = `${adminId}:${eventId}`
    const now = Date.now()
    const entry = rateLimitMap.get(key)

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
        return true // allowed
    }
    if (entry.count >= RATE_LIMIT) return false // blocked
    entry.count += 1
    return true // allowed
}

export async function POST(req: Request) {
    try {
        const session = await requireAdmin()
        const adminId = session.userId

        const body = await req.json()
        const { eventId, target, emails, userIds, customMessage } = body as {
            eventId: string
            target: string          // validated below — don't trust the cast
            emails?: string[]
            userIds?: string[]      // for target === 'users'
            customMessage?: string  // optional personal note injected into email body
        }

        // ── Input validation ────────────────────────────────────────────────
        if (!eventId) {
            return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
        }
        if (!VALID_TARGETS.includes(target as ShareTarget)) {
            return NextResponse.json(
                { error: `target must be one of: ${VALID_TARGETS.join(', ')}` },
                { status: 400 },
            )
        }

        // ── Rate limiting ───────────────────────────────────────────────────
        if (!checkRateLimit(adminId, eventId)) {
            return NextResponse.json(
                { error: `Too many share requests — wait a minute before resending` },
                { status: 429 },
            )
        }

        // ── Load the event (typed — no `as any`) ────────────────────────────
        const event = await prisma.liveEvent.findUnique({
            where: { id: eventId },
            select: { id: true, title: true, eventType: true, roomName: true, status: true },
        })
        if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
        const roomUrl = `${siteUrl}/en/events/${event.roomName}`

        // ── Build per-locale translations (static — no runtime API call) ────
        const translations: Record<string, Record<string, string>> = {}
        for (const loc of LOCALES) {
            const s       = INVITE_STRINGS[loc]
            const typeLbl = EVENT_TYPE_LABELS[event.eventType]?.[loc]
                          ?? EVENT_TYPE_LABELS.general[loc]
            translations[loc] = {
                title:   s.notifTitle(event.title),
                message: s.notifMessage(event.title, typeLbl),
                // Locale-specific room URL (e.g. /fr/events/… for French users)
                link: `${siteUrl}/${loc}/events/${event.roomName}`,
            }
        }

        // ── English email HTML (fallback; notifyUser rebuilds for other locales) ──
        const enS    = INVITE_STRINGS['en']
        const enType = EVENT_TYPE_LABELS[event.eventType]?.['en'] ?? 'Live Event'
        // If a custom message was provided, append it after the standard body copy
        const enBodyText = enS.emailBody(event.title, enType)
        const enBodyWithNote = customMessage?.trim()
            ? `${enBodyText}<br/><br/><em style="color:#888;font-size:0.9em;">${customMessage.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</em>`
            : enBodyText
        const emailHtml = announcementEmail(
            enS.notifTitle(event.title),
            enBodyWithNote,
            roomUrl,
            siteUrl,
            {
                badgeText:   enS.badgeText,
                buttonText:  enS.buttonText,
                footerOptIn: enS.footerOptIn,
                managePrefs: enS.managePrefs,
            },
        )

        let targeted = 0   // number of users/addresses targeted (not confirmed deliveries)

        if (target === 'all') {
            // Fetch only IDs + preference flags — minimal projection.
            const users = await prisma.user.findMany({
                select: {
                    id: true,
                    notificationPreference: { select: { announcement: true } },
                },
            })

            // Only send to users who have NOT explicitly opted out of announcements
            const eligible = users.filter(u =>
                !u.notificationPreference || u.notificationPreference.announcement !== false
            )
            targeted = eligible.length

            // Process in batches of 50.
            // NOTE: For very large user bases (5 000+) this sequential loop may approach
            // Vercel's function timeout. If that becomes an issue, move to a background
            // queue via broadcastNotification() or a dedicated worker endpoint.
            const BATCH = 50
            for (let i = 0; i < eligible.length; i += BATCH) {
                const batch = eligible.slice(i, i + BATCH)
                await Promise.allSettled(
                    batch.map(u => notifyUser({
                        userId:       u.id,
                        type:         'announcement',
                        title:        enS.notifTitle(event.title),
                        message:      enS.notifMessage(event.title, enType),
                        link:         roomUrl,
                        emailSubject: enS.subject(event.title),
                        emailHtml,
                        translations, // notifyUser selects the right locale from DB
                    }))
                )
            }
        } else if (target === 'users') {
            // Specific user invite — only to the selected user IDs
            if (!userIds?.length) {
                return NextResponse.json({ error: 'At least one user must be selected' }, { status: 400 })
            }
            const selectedUsers = await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true },
            })
            targeted = selectedUsers.length
            const results = await Promise.allSettled(
                selectedUsers.map(u => notifyUser({
                    userId:       u.id,
                    type:         'announcement',
                    title:        enS.notifTitle(event.title),
                    message:      enS.notifMessage(event.title, enType),
                    link:         roomUrl,
                    emailSubject: enS.subject(event.title),
                    emailHtml,
                    translations,
                }))
            )
            // Log any per-user delivery failures for server-side debugging
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    console.error(`[rooms/share] notifyUser failed for userId=${selectedUsers[i]?.id}:`, r.reason)
                }
            })
            const failed = results.filter(r => r.status === 'rejected').length
            if (failed > 0) {
                console.warn(`[rooms/share] users tab: ${targeted - failed}/${targeted} delivered, ${failed} failed`)
            }
        } else {
            // target === 'emails': external invites — plain email, English only
            const { sendEmail } = await import('@/lib/mailer')
            const rawEmails = (emails ?? [])
                .map(e => e.trim())
                .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) // basic format check

            targeted = rawEmails.length
            await Promise.allSettled(
                rawEmails.map(email =>
                    sendEmail({
                        to:      email,
                        subject: enS.subject(event.title),
                        html:    emailHtml,
                    })
                )
            )
        }

        // NOTE ON `targeted` vs `delivered`:
        // `targeted` = number of users/addresses the invite was dispatched to.
        // Actual delivery success is tracked by the mailer transport — we cannot
        // report confirmed delivery counts here without async receipt hooks.
        return NextResponse.json({ targeted, eventTitle: event.title })
    } catch (error) {
        const msg    = error instanceof Error ? error.message : 'Internal server error'
        const status = msg === 'Unauthorized' ? 401 : msg.startsWith('Forbidden') ? 403 : 500
        return NextResponse.json({ error: msg }, { status })
    }
}
