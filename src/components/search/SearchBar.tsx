'use client';

import React, { useRef, useEffect } from 'react';
import { useSearch } from '@/components/search/SearchContext';
import { useTranslations } from 'next-intl';

interface SearchBarProps {
  autoFocus?: boolean;
  onSubmit?: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({ autoFocus, onSubmit }) => {
  const { query, search, loading } = useSearch();
  const t = useTranslations('search');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      // small delay to let the overlay animate in
      const timer = setTimeout(() => inputRef.current?.focus(), 200);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim() && onSubmit) {
      onSubmit();
    }
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
    }}>
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '16px',
        padding: '4px',
        transition: 'all 0.3s ease',
      }}>
        {/* Search icon */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '44px',
          height: '44px',
          flexShrink: 0,
        }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(200, 170, 110, 0.8)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => search(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder')}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#ffffff',
            fontSize: '1rem',
            fontWeight: 400,
            letterSpacing: '0.01em',
            padding: '12px 4px',
            width: '100%',
            caretColor: 'rgba(200, 170, 110, 0.9)',
          }}
        />

        {/* Loading spinner or clear button */}
        {(loading || query) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '44px',
            height: '44px',
            flexShrink: 0,
          }}>
            {loading ? (
              <div style={{
                width: '18px',
                height: '18px',
                border: '2px solid rgba(200, 170, 110, 0.2)',
                borderTopColor: 'rgba(200, 170, 110, 0.8)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : query ? (
              <button
                onClick={() => search('')}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '14px',
                  transition: 'all 0.2s',
                }}
                aria-label="Clear"
              >
                ✕
              </button>
            ) : null}
          </div>
        )}
      </div>

    </div>
  );
};
