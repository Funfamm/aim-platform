"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface SiteSettings {
  siteName?: string;
  logoUrl?: string;
  castingCallsEnabled?: boolean;
  scriptCallsEnabled?: boolean;
  trainingEnabled?: boolean;
  donationsEnabled?: boolean;
  searchBetaEnabled?: boolean;
}

const SiteSettingsContext = createContext<SiteSettings | null>(null);

export const SiteSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/site-settings')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch(() => {
        if (!cancelled) setSettings({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SiteSettingsContext.Provider value={settings}>
      {children}
    </SiteSettingsContext.Provider>
  );
};

export const useSiteSettings = () => {
  return useContext(SiteSettingsContext);
};
