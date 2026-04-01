import React from 'react';
import Link from 'next/link';
import type { SearchResult } from '@/components/search/SearchContext';

// ResultItem renders a single search result using the API response shape
export const ResultItem: React.FC<{ result: SearchResult }> = ({ result }) => {
  return (
    <Link href={result.href} className="result-item block p-3 rounded-lg hover:bg-white/10 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-xl">{result.icon}</span>
        <div className="flex flex-col">
          <span className="font-medium text-white">{result.title}</span>
          <span className="text-sm text-gray-400 capitalize">{result.subtitle || result.category}</span>
        </div>
      </div>
    </Link>
  );
};
