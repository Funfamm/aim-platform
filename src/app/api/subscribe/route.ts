import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { subscribeWelcomeBackWithOverrides } from '@/lib/email-templates'
import { t as et } from '@/lib/email-i18n'
import { randomBytes } from 'crypto'

// Simple in-memory rate limiter: max 3 subscribe attempts per IP per hour
const ipAttempts = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
    const now = Date.now()
    const windowMs = 60 * 60 * 1000 // 1 hour
    const attempts = (ipAttempts.get(ip) || []).filter(t => now - t < windowMs)
    if (attempts.length >= 3) return true
    attempts.push(now)
    ipAttempts.set(ip, attempts)
    return false
}

function buildConfirmUrl(token: string): string {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
    return `${siteUrl}/api/subscribe/confirm?token=${encodeURIComponent(token)}`
}

function confirmationEmailHtml(name: string | undefined, confirmUrl: string, locale: string, siteUrl: string): string {
    const label: Record<string, { heading: string; body: string; btn: string; footer: string }> = {
        en: { heading: 'Confirm your subscription', body: 'Click the button below to confirm your subscription to AIM Studio content updates.', btn: 'Confirm Subscription', footer: "If you didn't request this, you can safely ignore this email." },
        ar: { heading: 'تأكيد اشتراكك', body: 'انقر على الزر أدناه لتأكيد اشتراكك في تحديثات محتوى AIM Studio.', btn: 'تأكيد الاشتراك', footer: 'إذا لم تطلب ذلك، يمكنك تجاهل هذا البريد الإلكتروني.' },
        de: { heading: 'Abonnement bestätigen', body: 'Klicken Sie auf die Schaltfläche unten, um Ihr AIM Studio Abonnement zu bestätigen.', btn: 'Abonnement bestätigen', footer: 'Wenn Sie dies nicht angefordert haben, können Sie diese E-Mail ignorieren.' },
        es: { heading: 'Confirma tu suscripción', body: 'Haz clic en el botón de abajo para confirmar tu suscripción a las actualizaciones de AIM Studio.', btn: 'Confirmar suscripción', footer: 'Si no solicitaste esto, puedes ignorar este correo.' },
        fr: { heading: 'Confirmez votre abonnement', body: "Cliquez sur le bouton ci-dessous pour confirmer votre abonnement aux mises à jour d'AIM Studio.", btn: "Confirmer l'abonnement", footer: "Si vous n'avez pas demandé cela, vous pouvez ignorer cet e-mail." },
        hi: { heading: 'सदस्यता की पुष्टि करें', body: 'AIM Studio सामग्री अपडेट की सदस्यता की पुष्टि के लिए नीचे दिए गए बटन पर क्लिक करें।', btn: 'सदस्यता की पुष्टि करें', footer: 'यदि आपने यह अनुरोध नहीं किया था, तो इस ईमेल को अनदेखा करें।' },
        ja: { heading: '購読を確認する', body: 'AIM Studio コンテンツ更新の購読を確認するには、以下のボタンをクリックしてください。', btn: '購読を確認する', footer: 'ご自身でリクエストしていない場合は、このメールを無視してください。' },
        ko: { heading: '구독 확인', body: 'AIM Studio 콘텐츠 업데이트 구독을 확인하려면 아래 버튼을 클릭하세요.', btn: '구독 확인', footer: '이 요청을 하지 않으셨다면 이 이메일을 무시하셔도 됩니다.' },
        pt: { heading: 'Confirme sua assinatura', body: 'Clique no botão abaixo para confirmar sua assinatura das atualizações do AIM Studio.', btn: 'Confirmar assinatura', footer: 'Se você não solicitou isso, pode ignorar este e-mail.' },
        ru: { heading: 'Подтвердите подписку', body: 'Нажмите кнопку ниже, чтобы подтвердить подписку на обновления AIM Studio.', btn: 'Подтвердить подписку', footer: 'Если вы не запрашивали это, просто проигнорируйте письмо.' },
        zh: { heading: '确认订阅', body: '点击下面的按钮确认您对 AIM Studio 内容更新的订阅。', btn: '确认订阅', footer: '如果您没有提出此请求，请忽略此电子邮件。' },
    }
    const s = label[locale] ?? label['en']
    const greet = name ? `, ${name}` : ''
    const BC = '#d4a853', BG = '#0f1115', CARD = '#1a1d23', BORDER = '#2a2d35', TP = '#e8e6e3', SEC = '#9ca3af'
    return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" style="background:${BG}"><tr><td align="center" style="padding:40px 16px">
<table width="580" style="max-width:580px;width:100%">
<tr><td style="height:4px;background:linear-gradient(90deg,${BC},#e8c36a,${BC});border-radius:12px 12px 0 0"></td></tr>
<tr><td style="padding:28px 36px 20px;text-align:center;background:${CARD};border-left:1px solid ${BORDER};border-right:1px solid ${BORDER}">
  <span style="font-size:26px;font-weight:800"><span style="color:${BC}">AIM</span><span style="color:${TP}"> Studio</span></span>
</td></tr>
<tr><td style="background:${CARD};border-left:1px solid ${BORDER};border-right:1px solid ${BORDER};padding:36px 36px 40px;text-align:center">
  <div style="font-size:48px;margin-bottom:16px">📧</div>
  <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${TP}">${s.heading}${greet}</h1>
  <p style="margin:0 0 28px;font-size:15px;color:${SEC};line-height:1.7">${s.body}</p>
  <a href="${confirmUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,${BC},#c49b3a);border-radius:8px;font-size:14px;font-weight:700;color:#0f1115;text-decoration:none">${s.btn}</a>
  <p style="margin:28px 0 0;font-size:12px;color:#6b7280">${s.footer}</p>
</td></tr>
<tr><td style="height:3px;background:linear-gradient(90deg,${BC},#e8c36a,${BC});border-radius:0 0 12px 12px"></td></tr>
<tr><td style="padding-top:24px;text-align:center"><p style="margin:0;font-size:12px;color:${SEC}">&copy; ${new Date().getFullYear()} AIM Studio &bull; ${siteUrl}</p></td></tr>
</table></td></tr></table></body></html>`
}

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

        if (isRateLimited(ip)) {
            return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
        }

        const { email, name, locale, website } = await request.json()

        // Honeypot: bots fill this hidden field; humans never see it
        if (website) return NextResponse.json({ success: true })

        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 })
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email.trim())) {
            return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
        }

        const normalizedEmail = email.trim().toLowerCase().slice(0, 254)
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
        const userLocale = locale || 'en'

        // ── Check existing subscription state ─────────────────────────────────
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const db = prisma as any
        const existing = await db.subscriber.findUnique({
            where: { email: normalizedEmail },
            select: { active: true, confirmedAt: true },
        })

        // Case 1: Already actively subscribed — return early, no spam
        if (existing?.active === true) {
            return NextResponse.json({ success: true, alreadySubscribed: true })
        }

        // Case 2: Was previously unsubscribed (confirmed once, now inactive) — reactivate + welcome back
        // Returning subscribers skip double opt-in since they already confirmed once
        if (existing && existing.confirmedAt) {
            await db.subscriber.update({
                where: { email: normalizedEmail },
                data: { active: true, ...(name ? { name } : {}), confirmToken: null },
            })
            sendEmail({
                to: normalizedEmail,
                subject: et('subscribeWelcomeBack', userLocale, 'subject') || 'Welcome back to AIM Studio! 🎬',
                html: await subscribeWelcomeBackWithOverrides(name || undefined, siteUrl, userLocale),
            }).catch(err => console.error('[subscribe] Welcome-back email failed:', err))
            return NextResponse.json({ success: true, welcomed: true })
        }

        // Case 3: New subscriber OR pending confirmation — generate/refresh token, send confirmation email
        const confirmToken = randomBytes(32).toString('hex')
        const confirmUrl = buildConfirmUrl(confirmToken)

        if (existing && !existing.confirmedAt) {
            // Pending confirmation — refresh token and resend
            await db.subscriber.update({
                where: { email: normalizedEmail },
                data: { confirmToken, ...(name ? { name } : {}) },
            })
        } else {
            // Brand new
            await db.subscriber.create({
                data: { email: normalizedEmail, name: name || null, active: false, confirmToken },
            })
        }

        sendEmail({
            to: normalizedEmail,
            subject: `Confirm your AIM Studio subscription`,
            html: confirmationEmailHtml(name || undefined, confirmUrl, userLocale, siteUrl),
        }).catch(err => console.error('[subscribe] Confirmation email failed:', err))

        return NextResponse.json({ success: true, awaitingConfirmation: true })
    } catch (error) {
        console.error('Subscribe error:', error)
        return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
    }
}
