import React from 'react'

export function AppSpinner() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '50vh', // Centers within the page content area
      width: '100%',
    }}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes elegant-spin {
          100% { transform: rotate(360deg); }
        }
        @keyframes elegant-dash {
          0% { stroke-dasharray: 1, 200; stroke-dashoffset: 0; }
          50% { stroke-dasharray: 90, 200; stroke-dashoffset: -35px; }
          100% { stroke-dasharray: 90, 200; stroke-dashoffset: -124px; }
        }
      `}} />
      <svg 
        viewBox="25 25 50 50"
        style={{
          width: '36px',
          height: '36px',
          animation: 'elegant-spin 2s linear infinite'
        }}
      >
        <circle 
          cx="50" cy="50" r="20" 
          fill="none" 
          stroke="var(--accent-gold, #D4AF37)" 
          strokeWidth="3" 
          strokeLinecap="round"
          style={{
            animation: 'elegant-dash 1.5s ease-in-out infinite'
          }}
        />
      </svg>
    </div>
  )
}
