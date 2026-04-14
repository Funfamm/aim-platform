"use client";
import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

interface SiteSettings {
  siteName?: string;
  logoUrl?: string;
  castingCallsEnabled?: boolean;
  scriptCallsEnabled?: boolean;
  trainingEnabled?: boolean;
  donationsEnabled?: boolean;
  searchBetaEnabled?: boolean;
  sponsorsPageEnabled?: boolean;
}

interface SiteSettingsContextValue {
  settings: SiteSettings;
  refresh: () => void;
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
  sponsorsPageEnabled: false,
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

export function clearSiteSettingsCache() {
  try { localStorage.removeItem(CACHE_KEY); } catch { /* */ }
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: STABLE_DEFAULTS,
  refresh: () => {},
});

export const SiteSettingsProvider = ({ children }: { children: ReactNode }) => {
  // Initialise from cache instantly (no null flash), fallback to stable defaults.
  const [settings, setSettings] = useState<SiteSettings>(() => readCache() ?? STABLE_DEFAULTS);

  const fetchSettings = useCallback(() => {
    fetch('/api/site-settings')
      .then((r) => r.json())
      .then((data: SiteSettings) => {
        setSettings(data);
        writeCache(data);
      })
      .catch(() => {
        // Fetch failed — keep cached/default values, don't blank the nav
      });
  }, []);

  const refresh = useCallback(() => {
    clearSiteSettingsCache();
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchSettings();
    // Listen for storage events so admin saves in other tabs apply immediately
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CACHE_KEY && e.newValue === null) {
        // Cache was cleared (admin saved settings) — re-fetch
        fetchSettings();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [fetchSettings]);

  return (
    <SiteSettingsContext.Provider value={{ settings, refresh }}>
      {children}
    </SiteSettingsContext.Provider>
  );
};

export const useSiteSettings = () => {
  return useContext(SiteSettingsContext);
};
