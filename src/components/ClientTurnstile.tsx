'use client'

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { usePathname } from 'next/navigation'

export interface ClientTurnstileHandle {
    reset: () => void
}

interface ClientTurnstileProps {
    siteKey: string
    onSuccess: (token: string) => void
    onError?: () => void
    onExpire?: () => void
    label?: string
    labelStyle?: React.CSSProperties
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SCRIPT_ID = 'cf-turnstile-script'
const SCRIPT_SRC_PREFIX = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

declare global {
    interface Window {
        turnstile?: any
    }
}

const ClientTurnstile = forwardRef<ClientTurnstileHandle, ClientTurnstileProps>(
    ({ siteKey, onSuccess, onError, onExpire, label, labelStyle }, ref) => {
        const [isNarrow, setIsNarrow] = useState(false)
        const [scriptFailed, setScriptFailed] = useState(false)
        const containerRef = useRef<HTMLDivElement>(null)
        const widgetIdRef = useRef<string | null>(null)
        const pathname = usePathname()

        // Stable refs for callbacks — avoids re-running the render effect on every parent re-render
        const callbacks = useRef({ onSuccess, onError, onExpire })
        useEffect(() => {
            callbacks.current = { onSuccess, onError, onExpire }
        }, [onSuccess, onError, onExpire])

        useImperativeHandle(ref, () => ({
            reset: () => {
                if (widgetIdRef.current !== null && window.turnstile) {
                    window.turnstile.reset(widgetIdRef.current)
                }
            },
        }))

        // Width check — runs once on mount, then on resize
        useEffect(() => {
            const checkWidth = () => setIsNarrow(window.innerWidth < 480)
            checkWidth()
            window.addEventListener('resize', checkWidth, { passive: true })
            return () => window.removeEventListener('resize', checkWidth)
        }, [])

        useEffect(() => {
            if (!siteKey) return

            // Ensure the Turnstile script is in the page exactly once.
            // Check by URL prefix as well as ID: next/script may not set the DOM id attribute.
            if (
                !document.getElementById(SCRIPT_ID) &&
                !document.querySelector(`script[src^="${SCRIPT_SRC_PREFIX}"]`)
            ) {
                const script = document.createElement('script')
                script.id = SCRIPT_ID
                script.src = SCRIPT_URL
                script.async = true
                script.defer = true
                document.head.appendChild(script)
            }

            let cancelled = false
            const timers: ReturnType<typeof setTimeout>[] = []

            const removeWidget = () => {
                if (widgetIdRef.current !== null && window.turnstile) {
                    try { window.turnstile.remove(widgetIdRef.current) } catch {}
                    widgetIdRef.current = null
                }
                // Clear stale Cloudflare iframe from a previous lifecycle
                if (containerRef.current) containerRef.current.innerHTML = ''
            }

            const renderWidget = () => {
                if (cancelled || !containerRef.current || !window.turnstile) return
                removeWidget()
                try {
                    widgetIdRef.current = window.turnstile.render(containerRef.current, {
                        sitekey: siteKey,
                        theme: 'dark',
                        size: isNarrow ? 'compact' : 'normal',
                        retry: 'auto',
                        'retry-interval': 5000,
                        callback: (token: string) => callbacks.current.onSuccess(token),
                        'error-callback': () => {
                            callbacks.current.onSuccess('')
                            callbacks.current.onError?.()
                        },
                        'expired-callback': () => {
                            callbacks.current.onSuccess('')
                            callbacks.current.onExpire?.()
                        },
                        'timeout-callback': () => {
                            callbacks.current.onSuccess('')
                            callbacks.current.onExpire?.()
                        },
                        'unsupported-callback': () => {
                            callbacks.current.onSuccess('')
                            callbacks.current.onError?.()
                        },
                    })
                } catch (e) {
                    console.error('[Turnstile] render error:', e)
                    if (!cancelled) setScriptFailed(true)
                }
            }

            if (window.turnstile) {
                renderWidget()
            } else {
                // Poll until the Cloudflare script finishes loading
                const poll = () => {
                    if (cancelled) return
                    if (window.turnstile) {
                        renderWidget()
                        return
                    }
                    timers.push(setTimeout(poll, 100))
                }
                poll()
                // Hard timeout — if script never loads, show error so user has a clear action
                timers.push(setTimeout(() => {
                    if (!cancelled && !widgetIdRef.current) setScriptFailed(true)
                }, 15000))
            }

            return () => {
                cancelled = true
                timers.forEach(clearTimeout)
                removeWidget()
                callbacks.current.onSuccess('')
            }
        }, [siteKey, isNarrow, pathname])
        // pathname dep: re-renders widget on SPA navigation for components in persistent layouts

        if (!siteKey) return null

        // No `mounted` guard — effects are client-only, so the container is always safe
        // to render. Removing the two-render cycle (null → div) eliminates the race window
        // where containerRef.current was null when the effect first tried to call render().
        return (
            <div style={{ textAlign: 'left' }}>
                {label && (
                    <p style={{
                        fontSize: '0.78rem',
                        color: 'rgba(255,255,255,0.55)',
                        margin: '0 0 8px',
                        fontWeight: 500,
                        ...(labelStyle || {}),
                    }}>
                        {label}
                    </p>
                )}
                {scriptFailed ? (
                    <div style={{
                        padding: '10px',
                        background: 'rgba(245,158,11,0.12)',
                        border: '1px solid rgba(245,158,11,0.4)',
                        borderRadius: 'var(--radius-md)',
                        color: '#f59e0b',
                        fontSize: '0.8rem',
                        lineHeight: 1.4,
                    }}>
                        Verification could not load. Please refresh or allow verification scripts for this site.
                    </div>
                ) : (
                    <div style={{
                        display: 'flex',
                        justifyContent: isNarrow ? 'flex-start' : 'center',
                        minHeight: isNarrow ? '140px' : '65px',
                        overflow: 'visible',
                    }}>
                        <div ref={containerRef} />
                    </div>
                )}
            </div>
        )
    }
)

ClientTurnstile.displayName = 'ClientTurnstile'
export default ClientTurnstile
