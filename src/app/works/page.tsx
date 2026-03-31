import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Works – AIM Studio',
  description: 'Redirecting to the works page.',
};

export default function WorksRedirect() {
  redirect('/en/works');
}
