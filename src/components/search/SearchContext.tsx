'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useLocale } from 'next-intl';

// Shape returned by /api/search
export interface SearchResult {
  category: string;   // 'Films' | 'Casting' | 'Training' | 'Scripts' | 'Sponsors' | 'Pages'
  icon: string;
  title: string;
  subtitle: string;
  href: string;
}

interface SearchContextProps {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  loading: boolean;
  search: (q: string) => void;
}

const SearchContext = createContext<SearchContextProps | undefined>(undefined);

export const SearchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locale = useLocale();

  const fetchResults = async (q: string) => {
    if (!q || q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Use ?q= (matches route.ts which reads searchParams.get('q'))
      // Pass locale so translated content is returned
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&locale=${locale}`);
      if (!res.ok) throw new Error(`Search API ${res.status}`);
      const data = await res.json();
      setResults(data.results || []);
      // Fire-and-forget analytics
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'search', query: q, resultsCount: (data.results || []).length }),
      }).catch(() => {});
    } catch (err) {
      console.error('Search error', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const debouncedFetch = useCallback((q: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchResults(q), 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const search = (q: string) => {
    setQuery(q);
    debouncedFetch(q);
  };

  return (
    <SearchContext.Provider value={{ query, setQuery, results, loading, search }}>
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within SearchProvider');
  return ctx;
};
