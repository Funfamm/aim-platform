'use client'

import { useEffect } from 'react'

const CSRF_COOKIE_NAME = 'csrf_token'
const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']

function getCsrfToken(): string | null {
    const match = document.cookie
        .split('; ')
        .find(row => row.startsWith(`${CSRF_COOKIE_NAME}=`))
    return match ? decodeURIComponent(match.split('=')[1]) : null
}

/**
 * Invisible client component that patches the global fetch()
 * to automatically inject the X-CSRF-Token header on all
 * mutation requests to any /api/* endpoint.
 *
 * Place this once in the root layout (or admin layout).
 */
export function CsrfProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const originalFetch = window.fetch.bind(window)

        window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = typeof input === 'string'
                ? input
                : input instanceof URL
                    ? input.toString()
                    : input instanceof Request
                        ? input.url
                        : String(input)

            const method = (init?.method || 'GET').toUpperCase()

            // Inject CSRF header on any mutation to /api/*
            if (MUTATION_METHODS.includes(method) && url.includes('/api/')) {
                const token = getCsrfToken()
                if (token) {
                    const headers = new Headers(init?.headers)
                    if (!headers.has('X-CSRF-Token') && !headers.has('x-csrf-token')) {
                        headers.set('X-CSRF-Token', token)
                    }
                    return originalFetch(input, { ...init, headers })
                }
            }

            return originalFetch(input, init)
        }

        return () => {
            // Restore original fetch on unmount
            window.fetch = originalFetch
        }
    }, [])

    return <>{children}</>
}
