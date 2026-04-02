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

// Stable defaults — match what an unconfigured server returns.
// Using explicit false for optional sections so they are HIDDEN until
// the fetch confirms they are enabled, preventing flash of unpublished tabs.
const STABLE_DEFAULTS: SiteSettings = {
  castingCallsEnabled: false,
  scriptCallsEnabled: false,
  trainingEnabled: false,
  donationsEnabled: false,
  searchBetaEnabled: false,
};

const CACHE_KEY = 'aim_site_settings_v1';

function readCache(): SiteSettings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(data: SiteSettings) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* quota */ }
}

const SiteSettingsContext = createContext<SiteSettings>(STABLE_DEFAULTS);

export const SiteSettingsProvider = ({ children }: { children: ReactNode }) => {
  // Initialise from cache instantly (no null flash), fallback to stable defaults.
  const [settings, setSettings] = useState<SiteSettings>(() => readCache() ?? STABLE_DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/site-settings')
      .then((r) => r.json())
      .then((data: SiteSettings) => {
        if (!cancelled) {
          setSettings(data);
          writeCache(data);
        }
      })
      .catch(() => {
        // Fetch failed — keep cached/default values, don't blank the nav
      });
    return () => { cancelled = true; };
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
