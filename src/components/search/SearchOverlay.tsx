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

const SearchOverlayContent: React.FC<SearchOverlayProps> = ({ isOpen, onClose }) => {
  const t = useTranslations('search');
  const { setQuery } = useSearch();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleClose = () => {
    setQuery('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            background: 'rgba(10, 12, 18, 0.97)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          {/* Top bar with close */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px 0',
              flexShrink: 0,
            }}
          >
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
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>ESC</span>
              {t('close') ?? 'Close'}
            </button>
          </motion.div>

          {/* Search input area */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            style={{
              padding: '20px 20px 0',
              flexShrink: 0,
            }}
          >
            <SearchBar autoFocus onSubmit={handleClose} />
          </motion.div>

          {/* Results area */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.3 }}
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '0 20px 20px',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <SuggestionPanel onNavigate={handleClose} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Portal wrapper to render on document.body, escaping any CSS transform stacking contexts
export const SearchOverlay: React.FC<SearchOverlayProps> = (props) => {
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <SearchOverlayContent {...props} />,
    document.body
  );
};
