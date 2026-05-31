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

declare global {
    interface Window {
        turnstile?: any
    }
}

const ClientTurnstile = forwardRef<ClientTurnstileHandle, ClientTurnstileProps>(
    ({ siteKey, onSuccess, onError, onExpire, label, labelStyle }, ref) => {
        const [mounted, setMounted] = useState(false)
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

        useEffect(() => {
            setMounted(true)
            const checkWidth = () => setIsNarrow(window.innerWidth < 480)
            checkWidth()
            window.addEventListener('resize', checkWidth, { passive: true })
            return () => window.removeEventListener('resize', checkWidth)
        }, [])

        useEffect(() => {
            if (!mounted) return

            // Ensure the script is injected exactly once globally
            if (!document.getElementById(SCRIPT_ID)) {
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
                // Clear any stale iframe left in the container
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
                // Poll until the script loads, then render
                const poll = () => {
                    if (cancelled) return
                    if (window.turnstile) {
                        renderWidget()
                        return
                    }
                    timers.push(setTimeout(poll, 100))
                }
                poll()
                // Hard timeout — show error after 15 s if script never loads
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
        }, [mounted, siteKey, isNarrow, pathname])
        // pathname dep: re-runs on every SPA navigation — critical for components
        // that live in persistent layouts (e.g. footer) and don't unmount between routes

        if (!mounted || !siteKey) return null

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
