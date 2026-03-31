'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export const metadata = {
  title: 'Works – AIM Studio',
  description: 'Redirecting to the works page.',
};

export default function WorksRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/en/works');
  }, [router]);
  return <h1>Redirecting to Works...</h1>;
}
