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
  // Trailer access control — gated client-side on the homepage poster cards.
  // Defaults to true (matches DB schema default), so trailers are visible
  // until the fetch confirms otherwise. API already returns this field.
  allowPublicTrailers?: boolean;
  // Footer-specific fields — exposed here so Footer.tsx reads from context
  // instead of making a redundant /api/site-settings fetch.
  socialLinks?: string
  footerPageData?: string
  tagline?: string
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
  // Default true — matches DB schema. Trailers show until fetch says otherwise.
  allowPublicTrailers: true,
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
  // Always start with STABLE_DEFAULTS — same value server and client use on first render.
  // Reading localStorage in the useState initializer was causing React error #418:
  // server renders with STABLE_DEFAULTS, but returning clients rendered with cached
  // settings (e.g. castingCallsEnabled: true), producing different Navbar HTML.
  const [settings, setSettings] = useState<SiteSettings>(STABLE_DEFAULTS)

  const fetchSettings = useCallback((applyCache = false) => {
    // On first call, apply cached settings immediately before the fetch resolves
    // so the UI reflects the last known state without a flash.
    // applyCache=true only on initial mount — avoids setState-in-effect lint error.
    if (applyCache) {
      const cached = readCache()
      if (cached) setSettings(cached)
    }
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
    // applyCache=true: apply localStorage cache before the fetch resolves (no flash)
    fetchSettings(true);
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
