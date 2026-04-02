import { redirect } from 'next/navigation';
import { defaultLocale } from '@/i18n/routing';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Works – AIM Studio',
  description: 'Redirecting to the works page.',
};

export default function WorksRedirect() {
  redirect(`/${defaultLocale}/works`);
}
