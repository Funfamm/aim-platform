import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { AuthProvider } from "@/components/AuthProvider";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HtmlDirSetter } from "@/components/HtmlDirSetter";
import Navbar from "@/components/Navbar";
import MobileTabBar from "@/components/MobileTabBar";
import PageTransition from "@/components/PageTransition";
import SiteSettingsWrapper from "@/components/SiteSettingsWrapper";

const RTL_LOCALES = ['ar', 'he', 'fa', 'ur'];

export const dynamic = 'force-dynamic'


export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // Validate locale
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();
  const isRtl = RTL_LOCALES.includes(locale);

  return (
    <ErrorBoundary>
      <NextIntlClientProvider messages={messages}>
        <AuthProvider>
          <HtmlDirSetter locale={locale} dir={isRtl ? 'rtl' : 'ltr'} />
          <AnalyticsTracker />
          <div dir={isRtl ? 'rtl' : 'ltr'} style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
            <SiteSettingsWrapper>
              <Navbar />
              <MobileTabBar />
              <PageTransition>
                {children}
              </PageTransition>
            </SiteSettingsWrapper>
          </div>
        </AuthProvider>
      </NextIntlClientProvider>
    </ErrorBoundary>
  );
}

