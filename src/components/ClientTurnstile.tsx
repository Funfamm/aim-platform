'use client'

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

interface ClientTurnstileProps {
    siteKey: string
    onSuccess: (token: string) => void
    onError?: () => void
    onExpire?: () => void
    /** Extra text shown above the widget */
    label?: string
    /** Custom label styles */
    labelStyle?: React.CSSProperties
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SCRIPT_ID = 'cf-turnstile-script'

declare global {
    interface Window {
        turnstile?: any
    }
}

const ClientTurnstile = forwardRef<any, ClientTurnstileProps>(
    ({ siteKey, onSuccess, onError, onExpire, label, labelStyle }, ref) => {
        const [mounted, setMounted] = useState(false)
        const [isNarrow, setIsNarrow] = useState(false)
        const [scriptFailed, setScriptFailed] = useState(false)
        
        const containerRef = useRef<HTMLDivElement>(null)
        const widgetIdRef = useRef<string | null>(null)
        
        // Use refs for callbacks to avoid re-running the effect on every parent render
        const callbacks = useRef({ onSuccess, onError, onExpire })
        useEffect(() => {
            callbacks.current = { onSuccess, onError, onExpire }
        }, [onSuccess, onError, onExpire])

        useImperativeHandle(ref, () => ({
            reset: () => {
                if (widgetIdRef.current !== null && window.turnstile) {
                    window.turnstile.reset(widgetIdRef.current)
                }
            }
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

            // 1. Ensure the Turnstile script is present exactly once
            let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
            if (!script) {
                script = document.createElement('script')
                script.id = SCRIPT_ID
                script.src = SCRIPT_URL
                script.async = true
                script.defer = true
                document.head.appendChild(script)
            }

            // 2. Helper that resolves when the Turnstile API is ready
            const waitForTurnstile = (): Promise<void> => {
                return new Promise((resolve) => {
                    if (window.turnstile && typeof window.turnstile.render === 'function') {
                        resolve()
                        return
                    }
                    const onLoad = () => {
                        if (window.turnstile && typeof window.turnstile.render === 'function') {
                            resolve()
                        } else {
                            // fallback: keep waiting
                            poll()
                        }
                    }
                    // If the script element already fired load, the onload may not fire again
                    script!.addEventListener('load', onLoad)
                    // Poll as a safety net (in case load event missed)
                    const poll = () => {
                        if (window.turnstile && typeof window.turnstile.render === 'function') {
                            script!.removeEventListener('load', onLoad)
                            resolve()
                        } else {
                            setTimeout(poll, 100)
                        }
                    }
                    poll()
                })
            }

            // 3. Initialise widget once the API is ready
            let attempts = 0
            let pollTimer: NodeJS.Timeout
            const initWidget = async () => {
                try {
                    await waitForTurnstile()
                } catch {
                    // Should never happen; fallback to polling below
                }
                if (containerRef.current && window.turnstile) {
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
                                if (callbacks.current.onError) callbacks.current.onError()
                            },
                            'expired-callback': () => {
                                callbacks.current.onSuccess('')
                                if (callbacks.current.onExpire) callbacks.current.onExpire()
                            },
                            'timeout-callback': () => {
                                callbacks.current.onSuccess('')
                                if (callbacks.current.onExpire) callbacks.current.onExpire()
                            },
                            'unsupported-callback': () => {
                                callbacks.current.onSuccess('')
                                if (callbacks.current.onError) callbacks.current.onError()
                            }
                        })
                    } catch (e) {
                        console.error('Turnstile render error:', e)
                        setScriptFailed(true)
                    }
                } else if (attempts < 200) { // up to 20 s max wait
                    attempts++
                    pollTimer = setTimeout(initWidget, 100)
                } else {
                    setScriptFailed(true)
                }
            }

            initWidget()

            return () => {
                clearTimeout(pollTimer)
                if (widgetIdRef.current !== null && window.turnstile) {
                    window.turnstile.remove(widgetIdRef.current)
                    widgetIdRef.current = null
                }
                callbacks.current.onSuccess('')
            }
        }, [mounted, siteKey, isNarrow])

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
                        lineHeight: 1.4
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
