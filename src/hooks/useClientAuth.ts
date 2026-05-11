'use client'

import { useEffect, useState } from 'react'

/**
 * Client-side hook that checks auth state after hydration.
 * Returns { isLoggedIn, userId, role } — all null/false during SSR and initial render.
 * This allows pages using it to be ISR-cached (no cookie read on server).
 */
export function useClientAuth() {
    const [auth, setAuth] = useState<{
        isLoggedIn: boolean
        userId: string | null
        role: string | null
    }>({ isLoggedIn: false, userId: null, role: null })

    useEffect(() => {
        fetch('/api/auth/me', { credentials: 'include' })
            .then(r => { if (!r.ok) throw new Error(); return r.json() })
            .then(data => {
                if (data?.user?.id) {
                    setAuth({ isLoggedIn: true, userId: data.user.id, role: data.user.role || null })
                }
            })
            .catch(() => { /* stay unauthenticated */ })
    }, [])

    return auth
}
