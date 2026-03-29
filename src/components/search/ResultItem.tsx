import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export type SearchResult = {
  id: string;
  type: 'project' | 'castingCall' | 'scriptCall' | 'sponsor';
  title: string;
  slug?: string;
  imageUrl?: string;
};

export const ResultItem: React.FC<{ result: SearchResult }> = ({ result }) => {
  const t = useTranslations('search');
  const getLink = () => {
    switch (result.type) {
      case 'project':
        return `/projects/${result.slug ?? result.id}`;
      case 'castingCall':
        return `/casting/${result.id}`;
      case 'scriptCall':
        return `/scripts/${result.id}`;
      case 'sponsor':
        return `/sponsors/${result.id}`;
      default:
        return '#';
    }
  };

  return (
    <Link href={getLink()} className="result-item block p-3 rounded-lg hover:bg-white/10 transition-colors">
      <div className="flex items-center gap-3">
        {result.imageUrl && (
          <img src={result.imageUrl} alt={result.title} className="w-10 h-10 rounded object-cover" />
        )}
        <div className="flex flex-col">
          <span className="font-medium text-white">{result.title}</span>
          <span className="text-sm text-gray-400 capitalize">{t(`type.${result.type}`) ?? result.type}</span>
        </div>
      </div>
    </Link>
  );
};
