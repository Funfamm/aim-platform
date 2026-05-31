'use client'

/**
 * ClientTurnstile — a reusable wrapper around @marsidev/react-turnstile that
 * solves the SPA-navigation lifecycle problem.
 *
 * ## Problem
 * The Turnstile library uses a global singleton state machine for script
 * loading ('unloaded' → 'loading' → 'ready'). On a Next.js client-side
 * route transition, the Turnstile component unmounts (old page) and
 * re-mounts (new page). The old mount's `turnstile.remove()` runs during
 * cleanup, but the global state can get stuck in 'loading' if the callback
 * from the first mount hasn't fired yet — leaving the new mount's
 * `turnstile.render()` waiting on a Promise that never resolves.
 *
 * ## Solution
 * 1. Generate a unique `renderKey` on every mount (using a counter + timestamp)
 *    and pass it as the React `key` on the <Turnstile> element. This forces
 *    React to fully unmount/remount the Turnstile component, which triggers
 *    fresh script readiness checks inside the library.
 *
 * 2. Guard rendering behind a `mounted` flag (useEffect) to ensure the
 *    Turnstile component is only created in the browser after hydration —
 *    never during SSR or server component rendering.
 *
 * 3. Use 'compact' size on viewports ≤ 480px. Cloudflare's 'normal' widget
 *    requires ~300px minimum; on a 375px phone inside a padded modal the
 *    inner area is ~289px, causing the iframe to overflow and be clipped.
 */

import { useState, useEffect, useRef, forwardRef } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import type { TurnstileInstance } from '@marsidev/react-turnstile'

interface ClientTurnstileProps {
    siteKey: string
    onSuccess: (token: string) => void
    onError?: () => void
    onExpire?: () => void
    /** Extra text shown above the widget (e.g. "Let us know you are human") */
    label?: string
    /** Custom label styles */
    labelStyle?: React.CSSProperties
}

// Monotonically increasing counter to guarantee unique keys across mounts
let mountCounter = 0

const ClientTurnstile = forwardRef<TurnstileInstance | null, ClientTurnstileProps>(
    ({ siteKey, onSuccess, onError, onExpire, label, labelStyle }, ref) => {
        const [mounted, setMounted] = useState(false)
        const [isNarrow, setIsNarrow] = useState(false)
        // Unique key per mount — forces React to fully unmount/remount the
        // Turnstile component, resetting its internal script-ready state machine
        const renderKey = useRef(`turnstile-${++mountCounter}-${Date.now()}`)

        useEffect(() => {
            setMounted(true)

            const checkWidth = () => setIsNarrow(window.innerWidth < 480)
            checkWidth()
            window.addEventListener('resize', checkWidth, { passive: true })
            return () => window.removeEventListener('resize', checkWidth)
        }, [])

        if (!mounted || !siteKey) return null

        return (
            <div style={{ textAlign: 'left' }}>
                {label && (
                    <p style={{
                        fontSize: '0.78rem',
                        color: 'rgba(255,255,255,0.55)',
                        margin: '0 0 8px',
                        fontWeight: 500,
                        ...labelStyle,
                    }}>
                        {label}
                    </p>
                )}
                <div style={{
                    display: 'flex',
                    justifyContent: isNarrow ? 'flex-start' : 'center',
                    minHeight: '65px',
                    overflow: 'visible',
                }}>
                    <Turnstile
                        key={renderKey.current}
                        ref={ref}
                        siteKey={siteKey}
                        options={{
                            theme: 'dark',
                            size: isNarrow ? 'compact' : 'normal',
                            retry: 'auto',
                            retryInterval: 5000,
                        }}
                        onSuccess={onSuccess}
                        onExpire={onExpire}
                        onError={onError}
                    />
                </div>
            </div>
        )
    }
)

ClientTurnstile.displayName = 'ClientTurnstile'
export default ClientTurnstile
