import { redirect } from 'next/navigation';
import { defaultLocale } from '@/i18n/routing';

export default function RootRedirect() {
  // Redirect the base URL to the default locale (e.g., /en)
  redirect(`/${defaultLocale}`);
}
