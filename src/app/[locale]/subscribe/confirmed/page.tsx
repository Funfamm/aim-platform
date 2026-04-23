'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import Footer from '@/components/Footer'
import CinematicBackground from '@/components/CinematicBackground'

const STRINGS = {
    success: {
        icon: '🎉',
        title: { en: "You're subscribed!", ar: 'تم الاشتراك بنجاح!', de: 'Sie sind abonniert!', es: '¡Te has suscrito!', fr: 'Vous êtes abonné!', hi: 'आप सदस्य बन गए!', ja: '登録完了！', ko: '구독 완료!', pt: 'Você está inscrito!', ru: 'Вы подписаны!', zh: '订阅成功！' },
        body: { en: "Welcome to AIM Studio! You'll now receive updates whenever we publish new content.", ar: 'مرحباً بك في AIM Studio! ستتلقى الآن تحديثات عند نشر محتوى جديد.', de: 'Willkommen bei AIM Studio! Sie erhalten jetzt Aktualisierungen, wenn wir neue Inhalte veröffentlichen.', es: '¡Bienvenido a AIM Studio! Recibirás actualizaciones cada vez que publiquemos nuevo contenido.', fr: 'Bienvenue sur AIM Studio! Vous recevrez maintenant des mises à jour lorsque nous publierons du nouveau contenu.', hi: 'AIM Studio में आपका स्वागत है! जब भी हम नई सामग्री प्रकाशित करेंगे, आपको अपडेट मिलेगा।', ja: 'AIM Studioへようこそ！新しいコンテンツを公開するたびに更新をお届けします。', ko: 'AIM Studio에 오신 것을 환영합니다! 새 콘텐츠를 게시할 때마다 업데이트를 받으실 것입니다.', pt: 'Bem-vindo ao AIM Studio! Você receberá atualizações sempre que publicarmos novo conteúdo.', ru: 'Добро пожаловать в AIM Studio! Вы будете получать обновления при публикации нового контента.', zh: '欢迎来到 AIM Studio！我们发布新内容时，您将收到更新。' },
    },
    invalid: {
        icon: '⚠️',
        title: { en: 'Invalid confirmation link', ar: 'رابط تأكيد غير صالح', de: 'Ungültiger Bestätigungslink', es: 'Enlace de confirmación inválido', fr: 'Lien de confirmation invalide', hi: 'अमान्य पुष्टि लिंक', ja: '無効な確認リンク', ko: '유효하지 않은 확인 링크', pt: 'Link de confirmação inválido', ru: 'Неверная ссылка для подтверждения', zh: '无效的确认链接' },
        body: { en: 'This link may have already been used or is invalid. Try subscribing again.', ar: 'ربما تم استخدام هذا الرابط بالفعل أو أنه غير صالح. حاول الاشتراك مرة أخرى.', de: 'Dieser Link wurde möglicherweise bereits verwendet oder ist ungültig. Versuchen Sie erneut zu abonnieren.', es: 'Este enlace puede haber sido usado o es inválido. Intenta suscribirte de nuevo.', fr: "Ce lien a peut-être déjà été utilisé ou est invalide. Essayez de vous réabonner.", hi: 'यह लिंक पहले से उपयोग हो चुका होगा या अमान्य है। फिर से सदस्यता लेने का प्रयास करें।', ja: 'このリンクはすでに使用されているか、無効です。もう一度登録してみてください。', ko: '이 링크는 이미 사용되었거나 유효하지 않습니다. 다시 구독해 보세요.', pt: 'Este link pode já ter sido usado ou é inválido. Tente se inscrever novamente.', ru: 'Эта ссылка уже использована или недействительна. Попробуйте подписаться снова.', zh: '此链接可能已被使用或无效。请尝试重新订阅。' },
    },
    error: {
        icon: '❌',
        title: { en: 'Something went wrong', ar: 'حدث خطأ ما', de: 'Etwas ist schiefgelaufen', es: 'Algo salió mal', fr: "Une erreur s'est produite", hi: 'कुछ गलत हो गया', ja: 'エラーが発生しました', ko: '문제가 발생했습니다', pt: 'Algo deu errado', ru: 'Что-то пошло не так', zh: '出现了问题' },
        body: { en: 'We could not confirm your subscription. Please try again.', ar: 'لم نتمكن من تأكيد اشتراكك. يرجى المحاولة مرة أخرى.', de: 'Wir konnten Ihr Abonnement nicht bestätigen. Bitte versuchen Sie es erneut.', es: 'No pudimos confirmar tu suscripción. Por favor, inténtalo de nuevo.', fr: 'Nous n\'avons pas pu confirmer votre abonnement. Veuillez réessayer.', hi: 'हम आपकी सदस्यता की पुष्टि नहीं कर सके। कृपया पुनः प्रयास करें।', ja: '購読を確認できませんでした。もう一度お試しください。', ko: '구독을 확인할 수 없었습니다. 다시 시도해 주세요.', pt: 'Não foi possível confirmar sua assinatura. Por favor, tente novamente.', ru: 'Нам не удалось подтвердить вашу подписку. Попробуйте ещё раз.', zh: '我们无法确认您的订阅。请再试一次。' },
    },
}

const EXPLORE: Record<string, string> = { en: 'Explore our work', ar: 'استعرض أعمالنا', de: 'Unsere Arbeit erkunden', es: 'Explorar nuestro trabajo', fr: 'Explorer notre travail', hi: 'हमारा काम देखें', ja: '作品を見る', ko: '작품 보기', pt: 'Explorar nosso trabalho', ru: 'Изучить наши работы', zh: '探索我们的作品' }
const TRY_AGAIN: Record<string, string> = { en: 'Try again', ar: 'حاول مرة أخرى', de: 'Erneut versuchen', es: 'Intentar de nuevo', fr: 'Réessayer', hi: 'फिर से कोशिश करें', ja: '再試行', ko: '다시 시도', pt: 'Tentar novamente', ru: 'Попробовать снова', zh: '重试' }

export default function SubscribeConfirmedPage() {
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
                <div style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '16px' }}>{strings.icon}</div>
                    <h1 style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 800, marginBottom: '12px', color: 'var(--text-primary)' }}>
                        {strings.title[l] ?? strings.title['en']}
                    </h1>
                    <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '28px' }}>
                        {strings.body[l] ?? strings.body['en']}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
                        {status === 'success' ? (
                            <Link href={`/${locale}/works`} style={{
                                display: 'inline-block', padding: '0.7rem 1.8rem',
                                background: 'linear-gradient(135deg, var(--accent-gold), #c49b3a)',
                                borderRadius: 'var(--radius-md)', color: '#0f1115',
                                fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none',
                            }}>
                                {EXPLORE[l] ?? EXPLORE['en']}
                            </Link>
                        ) : (
                            <Link href={`/${locale}/subscribe`} style={{
                                display: 'inline-block', padding: '0.7rem 1.8rem',
                                background: 'rgba(212,168,83,0.1)', border: '1px solid rgba(212,168,83,0.3)',
                                borderRadius: 'var(--radius-md)', color: 'var(--accent-gold)',
                                fontWeight: 600, fontSize: '0.88rem', textDecoration: 'none',
                            }}>
                                {TRY_AGAIN[l] ?? TRY_AGAIN['en']}
                            </Link>
                        )}
                    </div>
                </div>
            </main>
            <Footer />
        </>
    )
}
