'use client'

import React, { Component, ReactNode } from 'react'

interface Props {
    children: ReactNode
    fallback?: ReactNode
}

interface State {
    hasError: boolean
    error?: Error
}

/**
 * Global Error Boundary
 *
 * Catches unhandled React rendering errors and displays a recovery UI.
 * Logs the error to the structured logger via API call.
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log to structured logger via API
        fetch('/api/log-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: 'react/ErrorBoundary',
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack,
            }),
        }).catch(() => {
            // Silent fail — don't crash the error boundary
        })

        console.error('ErrorBoundary caught:', error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div style={{
                    minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column', gap: '1rem', padding: '2rem', textAlign: 'center',
                }}>
                    <div style={{ fontSize: '2rem' }}>⚠️</div>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Something went wrong</h2>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', maxWidth: '400px' }}>
                        An unexpected error occurred. Please try refreshing the page.
                    </p>
                    <button
                        onClick={() => {
                            this.setState({ hasError: false, error: undefined })
                            window.location.reload()
                        }}
                        style={{
                            padding: '0.6rem 1.5rem', background: 'var(--accent-gold)',
                            border: 'none', borderRadius: 'var(--radius-md)', color: 'var(--bg-primary)',
                            fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
                        }}
                    >
                        Refresh Page
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}
