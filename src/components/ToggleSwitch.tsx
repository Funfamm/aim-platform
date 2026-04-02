'use client'

import React from 'react'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}

export default function ToggleSwitch({ checked, onChange, disabled = false }: ToggleSwitchProps) {
  return (
    <label style={{
      position: 'relative',
      display: 'inline-block',
      width: '44px',
      height: '24px',
    }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      <span style={{
        position: 'absolute',
        cursor: disabled ? 'not-allowed' : 'pointer',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: checked ? 'var(--accent-gold)' : 'var(--border-subtle)',
        transition: '.4s',
        borderRadius: '34px',
      }} />
      <span style={{
        position: 'absolute',
        content: "''",
        height: '18px',
        width: '18px',
        left: checked ? '22px' : '4px',
        bottom: '3px',
        backgroundColor: '#fff',
        transition: '.4s',
        borderRadius: '50%',
        boxShadow: '0 0 2px rgba(0,0,0,0.2)',
      }} />
    </label>
  )
}
