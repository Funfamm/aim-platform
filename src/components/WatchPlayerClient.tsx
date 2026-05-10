// This file is a client component wrapper for WatchPlayer which requires client-side rendering.
'use client';

import dynamic from 'next/dynamic';
import type { WatchProject } from '@/components/WatchPlayer';

// Dynamically import the actual WatchPlayer component with SSR disabled.
const WatchPlayer = dynamic(() => import('@/components/WatchPlayer'), { ssr: false });

export default function WatchPlayerClient({
  project,
  userPreferredLang = 'en',
}: {
  project: WatchProject;
  userPreferredLang?: string;
}) {
  return <WatchPlayer project={project} userPreferredLang={userPreferredLang} />;
}
