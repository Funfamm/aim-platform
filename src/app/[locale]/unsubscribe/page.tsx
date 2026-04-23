'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import Footer from '@/components/Footer'
import CinematicBackground from '@/components/CinematicBackground'

const STRINGS = {
    success: {
        icon: '✅',
        title: { en: "You've been unsubscribed", ar: 'تم إلغاء اشتراكك', de: 'Abgemeldet', es: 'Te has dado de baja', fr: 'Vous êtes désabonné', hi: 'सदस्यता रद्द की गई', ja: '配信停止しました', ko: '구독 취소됨', pt: 'Você cancelou a inscrição', ru: 'Вы отписались', zh: '您已取消订阅' },
        body: { en: "We've removed you from our content update emails. You won't receive any more publish notifications.", ar: 'لقد أزلناك من رسائل تحديثات المحتوى. لن تتلقى أي إشعارات نشر أخرى.', de: 'Sie wurden von unseren Inhalts-Update-E-Mails entfernt.', es: 'Te hemos eliminado de nuestros correos de actualización de contenido.', fr: "Vous avez été retiré de nos e-mails de mise à jour de contenu.", hi: 'हमने आपको सामग्री अपडेट ईमेल से हटा दिया है।', ja: 'コンテンツ更新メールからあなたを削除しました。', ko: '콘텐츠 업데이트 이메일에서 제거되었습니다.', pt: 'Removemos você dos e-mails de atualização de conteúdo.', ru: 'Мы удалили вас из рассылки обновлений контента.', zh: '我们已将您从内容更新邮件中删除。' },
        resubscribe: { en: 'Changed your mind? Subscribe again', ar: 'غيرت رأيك؟ اشترك مجدداً', de: 'Meinung geändert? Erneut anmelden', es: '¿Cambiaste de opinión? Suscríbete de nuevo', fr: "Vous avez changé d'avis ? Réabonnez-vous", hi: 'मन बदल गया? फिर से सदस्यता लें', ja: '気が変わりましたか？再度登録する', ko: '마음이 바뀌었나요? 다시 구독하기', pt: 'Mudou de ideia? Inscreva-se novamente', ru: 'Передумали? Подпишитесь снова', zh: '改变主意了？重新订阅' },
    },
    invalid: {
        icon: '⚠️',
        title: { en: 'Invalid or expired link', ar: 'رابط غير صالح أو منتهي الصلاحية', de: 'Ungültiger oder abgelaufener Link', es: 'Enlace inválido o expirado', fr: 'Lien invalide ou expiré', hi: 'अमान्य या समाप्त लिंक', ja: '無効または期限切れのリンク', ko: '유효하지 않거나 만료된 링크', pt: 'Link inválido ou expirado', ru: 'Недействительная или устаревшая ссылка', zh: '链接无效或已过期' },
        body: { en: 'This unsubscribe link is not valid. It may have already been used or the link may have been altered.', ar: 'رابط إلغاء الاشتراك غير صالح. ربما تم استخدامه بالفعل أو تم تعديله.', de: 'Dieser Abmeldelink ist ungültig.', es: 'Este enlace de baja no es válido.', fr: "Ce lien de désabonnement n'est pas valide.", hi: 'यह अनसब्सक्राइब लिंक मान्य नहीं है।', ja: 'この配信停止リンクは無効です。', ko: '이 구독 취소 링크는 유효하지 않습니다.', pt: 'Este link de cancelamento não é válido.', ru: 'Эта ссылка для отписки недействительна.', zh: '此退订链接无效。' },
        resubscribe: null,
    },
    error: {
        icon: '❌',
        title: { en: 'Something went wrong', ar: 'حدث خطأ ما', de: 'Etwas ist schiefgelaufen', es: 'Algo salió mal', fr: "Une erreur s'est produite", hi: 'कुछ गलत हो गया', ja: 'エラーが発生しました', ko: '문제가 발생했습니다', pt: 'Algo deu errado', ru: 'Что-то пошло не так', zh: '出现了问题' },
        body: { en: 'We were unable to process your unsubscribe request. Please try again or contact support.', ar: 'لم نتمكن من معالجة طلب إلغاء الاشتراك. يرجى المحاولة مرة أخرى.', de: 'Wir konnten Ihre Abmeldeanfrage nicht bearbeiten.', es: 'No pudimos procesar tu solicitud de baja.', fr: 'Nous n\'avons pas pu traiter votre demande de désabonnement.', hi: 'हम आपका अनसब्सक्राइब अनुरोध संसाधित नहीं कर सके।', ja: '配信停止リクエストを処理できませんでした。', ko: '구독 취소 요청을 처리할 수 없었습니다.', pt: 'Não foi possível processar sua solicitação de cancelamento.', ru: 'Не удалось обработать ваш запрос на отписку.', zh: '我们无法处理您的退订请求。' },
        resubscribe: null,
    },
}

const HOME: Record<string, string> = { en: 'Back to home', ar: 'العودة للرئيسية', de: 'Zurück zur Startseite', es: 'Volver al inicio', fr: "Retour à l'accueil", hi: 'होम पर वापस जाएं', ja: 'ホームに戻る', ko: '홈으로 돌아가기', pt: 'Voltar ao início', ru: 'Вернуться на главную', zh: '返回首页' }

export default function UnsubscribePage() {
    const searchParams = useSearchParams()
    const locale = useLocale()
    const status = (searchParams.get('status') || 'invalid') as 'success' | 'invalid' | 'error'
    const strings = STRINGS[status] ?? STRINGS.invalid
    const l = locale as keyof typeof strings.title

    return (
        <>
            <main style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 'calc(80px + var(--space-2xl)) var(--space-lg) var(--space-2xl)', position: 'relative',
            }}>
                <CinematicBackground variant="auth" />
                <div style={{ width: '100%', maxWidth: '460px', position: 'relative', zIndex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '16px' }}>{strings.icon}</div>
                    <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>
                        {strings.title[l] ?? strings.title['en']}
                    </h1>
                    <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '28px' }}>
                        {strings.body[l] ?? strings.body['en']}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                        {strings.resubscribe && (
                            <Link
                                href={`/${locale}/subscribe`}
                                style={{
                                    display: 'inline-block', padding: '0.7rem 1.8rem',
                                    background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.3)',
                                    borderRadius: 'var(--radius-md)', color: 'var(--accent-gold)',
                                    fontWeight: 600, fontSize: '0.88rem', textDecoration: 'none',
                                }}
                            >
                                {strings.resubscribe[l] ?? strings.resubscribe['en']}
                            </Link>
                        )}
                        <Link
                            href={`/${locale}`}
                            style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
                        >
                            {HOME[l] ?? HOME['en']}
                        </Link>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    )
}
