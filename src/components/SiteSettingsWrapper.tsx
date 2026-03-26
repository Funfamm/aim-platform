'use client';
import { SiteSettingsProvider } from '@/context/SiteSettingsContext';
import React from 'react';

export default function SiteSettingsWrapper({ children }: { children: React.ReactNode }) {
  return <SiteSettingsProvider>{children}</SiteSettingsProvider>;
}
