'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearch } from '@/components/search/SearchContext';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface SuggestionPanelProps {
  onNavigate?: () => void;
}

const QUICK_LINKS = [
  { key: 'browseAll', href: '/works', icon: '🎬' },
  { key: 'comingSoon', href: '/upcoming', icon: '🚀' },
  { key: 'openRoles', href: '/casting', icon: '🎭' },
  { key: 'learnSkills', href: '/training', icon: '📚' },
  { key: 'supportUs', href: '/donate', icon: '💛' },
  { key: 'about', href: '/about', icon: '✨' },
];

export const SuggestionPanel: React.FC<SuggestionPanelProps> = ({ onNavigate }) => {
  const { results, loading, query } = useSearch();
  const t = useTranslations('search');

  const hasResults = results.length > 0;
  const hasQuery = query.trim().length > 0;
  const showNoResults = hasQuery && !loading && !hasResults;

  return (
    <div style={{ marginTop: '20px' }}>
      <AnimatePresence mode="wait">
        {/* Search Results */}
        {hasQuery && hasResults && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <div style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
              marginBottom: '12px',
              paddingLeft: '4px',
            }}>
              {results.length} {results.length === 1 ? 'Result' : 'Results'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {results.slice(0, 8).map((result, i) => (
                <motion.div
                  key={`${result.category}-${result.title}-${i}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                >
                  <Link
                    href={result.href}
                    onClick={onNavigate}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '14px 16px',
                      borderRadius: '14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      textDecoration: 'none',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '12px',
                      background: 'rgba(200, 170, 110, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                      flexShrink: 0,
                    }}>
                      {result.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        color: '#ffffff',
                        fontWeight: 500,
                        fontSize: '0.95rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {result.title}
                      </div>
                      <div style={{
                        color: 'rgba(200, 170, 110, 0.6)',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        marginTop: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {result.subtitle || result.category}
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* No Results */}
        {showNoResults && (
          <motion.div
            key="no-results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            style={{
              textAlign: 'center',
              padding: '40px 20px',
            }}
          >
            <div style={{
              fontSize: '2.5rem',
              marginBottom: '16px',
              opacity: 0.6,
            }}>🔍</div>
            <div style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '0.95rem',
              fontWeight: 500,
              marginBottom: '8px',
            }}>
              {t('noResults').replace('{query}', query)}
            </div>
            <div style={{
              color: 'rgba(255,255,255,0.35)',
              fontSize: '0.82rem',
            }}>
              {t('tryDifferent')}
            </div>
          </motion.div>
        )}

        {/* Quick Access - shown when no query */}
        {!hasQuery && (
          <motion.div
            key="quick-access"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <div style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
              marginBottom: '14px',
              paddingLeft: '4px',
            }}>
              {t('quickAccess')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {QUICK_LINKS.map((link, i) => (
                <motion.div
                  key={link.key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.05, duration: 0.25 }}
                >
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '14px 16px',
                      borderRadius: '14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      textDecoration: 'none',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '12px',
                      background: 'rgba(200, 170, 110, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.1rem',
                      flexShrink: 0,
                    }}>
                      {link.icon}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        color: '#ffffff',
                        fontWeight: 500,
                        fontSize: '0.9rem',
                      }}>
                        {t(link.key)}
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Loading state */}
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              gap: '12px',
            }}
          >
            <div style={{
              width: '28px',
              height: '28px',
              border: '2.5px solid rgba(200, 170, 110, 0.15)',
              borderTopColor: 'rgba(200, 170, 110, 0.7)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            <span style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.82rem',
              fontWeight: 500,
            }}>
              {t('suggestions') ?? 'Searching...'}
            </span>
            <style jsx>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
