'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  id: string;
  type: 'project' | 'castingCall' | 'scriptCall' | 'sponsor';
  title: string;
  // add other fields as needed
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
  const router = useRouter();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = async (q: string) => {
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
      // Send analytics for search event
      try {
        await fetch('/api/analytics/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'search',
            query: q,
            resultsCount: (data.results || []).length,
          }),
        });
      } catch (analyticsErr) {
        console.warn('Analytics tracking failed', analyticsErr);
      }
    } catch (err) {
      console.error('Search error', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Inline debounce to avoid lodash dependency issues during build
  const debouncedFetch = useCallback((q: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchResults(q), 300);
  }, []);

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
  if (!ctx) {
    throw new Error('useSearch must be used within SearchProvider');
  }
  return ctx;
};
