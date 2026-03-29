'use client';

import React, { createContext, useContext, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface SearchResult {
  id: string;
  type: 'project' | 'castingCall' | 'scriptCall' | 'sponsor';
  title: string;
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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // router kept in case future versions navigate on search
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter();

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
      // Fire-and-forget analytics
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'search',
          query: q,
          resultsCount: (data.results || []).length,
        }),
      }).catch(() => { /* ignore analytics errors */ });
    } catch (err) {
      console.error('Search error', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Inline debounce — no lodash dependency needed
  const search = (q: string) => {
    setQuery(q);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchResults(q), 300);
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
