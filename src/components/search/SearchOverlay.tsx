'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchBar } from '@/components/search/SearchBar';
import { SuggestionPanel } from '@/components/search/SuggestionPanel';
import { useTranslations } from 'next-intl';
import { useSearch } from '@/components/search/SearchContext';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchOverlayInner: React.FC<SearchOverlayProps> = ({ isOpen, onClose }) => {
  const t = useTranslations('search');
  const { setQuery } = useSearch();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  // Don't render anything in the portal when closed
  if (!isOpen) return null;

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(10, 12, 18, 0.97)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px 0',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(200, 170, 110, 0.7)',
        }}>
          {t('searchButton')}
        </span>
        <button
          onClick={handleClose}
          aria-label={t('close') ?? 'Close'}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            color: 'rgba(255,255,255,0.6)',
            fontSize: '0.75rem',
            padding: '6px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>ESC</span>
          {t('close') ?? 'Close'}
        </button>
      </div>

      {/* Search input */}
      <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
        <SearchBar autoFocus onSubmit={handleClose} />
      </div>

      {/* Results */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '0 20px 20px',
        WebkitOverflowScrolling: 'touch',
      }}>
        <SuggestionPanel onNavigate={handleClose} />
      </div>
    </motion.div>
  );
};

// Portal wrapper — only mounts portal after client hydration
export const SearchOverlay: React.FC<SearchOverlayProps> = ({ isOpen, onClose }) => {
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Never render anything server-side or before hydration
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && <SearchOverlayInner isOpen={isOpen} onClose={onClose} />}
    </AnimatePresence>,
    document.body
  );
};
