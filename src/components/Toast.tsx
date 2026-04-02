'use client'

import React, { useEffect } from 'react'

interface ToastProps {
  visible: boolean
  message: string
  onClose: () => void
  duration?: number
}

export default function Toast({ visible, message, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [visible, duration, onClose])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      padding: '12px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      zIndex: 1000,
    }}>
      <span>{message}</span>
      <button onClick={onClose} style={{
        background: 'transparent',
        border: 'none',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: '1.2rem',
        lineHeight: 1,
      }}>✕</button>
    </div>
  )
}
