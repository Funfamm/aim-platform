import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing, locales } from '@/i18n/routing';
import { AuthProvider } from "@/components/AuthProvider";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { HtmlDirSetter } from "@/components/HtmlDirSetter";
import OrientationFix from "@/components/OrientationFix";
import Navbar from "@/components/Navbar";
import MobileTabBar from "@/components/MobileTabBar";
import PageTransition from "@/components/PageTransition";
import SiteSettingsWrapper from "@/components/SiteSettingsWrapper";
import { NotificationProvider } from "@/context/NotificationContext";
import type { Metadata } from 'next';

const RTL_LOCALES = ['ar', 'he', 'fa', 'ur'];

export const dynamic = 'force-dynamic'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://impactaistudio.com').replace(/\/$/, '')

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  // Build hreflang alternates for all supported locales
  const alternates: Record<string, string> = {}
  for (const loc of locales) {
    alternates[loc] = loc === 'en' ? SITE_URL : `${SITE_URL}/${loc}`
  }
  alternates['x-default'] = SITE_URL

  return {
    alternates: {
      canonical: locale === 'en' ? SITE_URL : `${SITE_URL}/${locale}`,
      languages: alternates,
    },
  }
}

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
          <OrientationFix />
          <AnalyticsTracker />
          <div dir={isRtl ? 'rtl' : 'ltr'} style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
            <SiteSettingsWrapper>
              <NotificationProvider>
                <Navbar />
                <MobileTabBar />
                <PageTransition>
                  {children}
                </PageTransition>
              </NotificationProvider>
            </SiteSettingsWrapper>
          </div>
        </AuthProvider>
      </NextIntlClientProvider>
    </ErrorBoundary>
  );
}
