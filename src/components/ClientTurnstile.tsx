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

        const [scriptFailed, setScriptFailed] = useState(false)
        const containerRef = useRef<HTMLDivElement>(null)
        const widgetIdRef = useRef<string | null>(null)
        const pathname = usePathname()

        // Reset scriptFailed when pathname changes ("derive state from props"
        // pattern from React docs). Runs during render, before effects, so
        // containerRef.current is guaranteed to point to the container div
        // by the time the main effect fires — no requestAnimationFrame needed.
        const [prevPathname, setPrevPathname] = useState(pathname)
        if (pathname !== prevPathname) {
            setPrevPathname(pathname)
            if (scriptFailed) setScriptFailed(false)
        }

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
            if (!siteKey) return

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
                        size: 'normal',
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

            // ── Script loading ──────────────────────────────────────────────
            // Strategy: use a shared promise so multiple effect cycles don't
            // inject duplicate scripts. If a previous script tag failed (e.g.
            // CSP block before the fix was deployed), remove it and retry.

            const ensureScript = (): Promise<void> => {
                // Already loaded → resolve immediately
                if (window.turnstile) return Promise.resolve()

                // Check for an existing script tag (ours or Next.js <Script>)
                const existing =
                    document.getElementById(SCRIPT_ID) as HTMLScriptElement | null ??
                    document.querySelector(`script[src^="${SCRIPT_SRC_PREFIX}"]`) as HTMLScriptElement | null

                // If a tag exists but window.turnstile is still undefined, the
                // script either failed (CSP, network) or is still loading.
                // - Our tags have data-injectedAt: safe to remove if stale (>10s) or failed.
                // - Next.js <Script> tags have neither attribute: fall through to the
                //   age-unknown branch which conservatively waits before removing.
                if (existing) {
                    const hasOurMeta = !!existing.dataset.injectedAt
                    const failed = existing.dataset.failed === 'true'
                    const age = Number(existing.dataset.injectedAt || 0)
                    const isStale = hasOurMeta && age && Date.now() - age > 10_000

                    if (failed || isStale) {
                        existing.remove()
                    } else if (!hasOurMeta) {
                        // Next.js <Script> tag — no metadata. If the page has been
                        // alive for a while and window.turnstile never appeared, the
                        // script is dead. Remove and re-inject our own tracked version.
                        // performance.now() > 10_000 means the page loaded > 10s ago.
                        if (performance.now() > 10_000) {
                            existing.remove()
                        }
                    }
                }

                // Re-check after possible removal
                const scriptInDom =
                    document.getElementById(SCRIPT_ID) ??
                    document.querySelector(`script[src^="${SCRIPT_SRC_PREFIX}"]`)

                if (!scriptInDom) {
                    // Inject a fresh script tag
                    const script = document.createElement('script')
                    script.id = SCRIPT_ID
                    script.src = SCRIPT_URL
                    script.async = true
                    script.defer = true
                    script.dataset.injectedAt = String(Date.now())
                    script.onerror = () => { script.dataset.failed = 'true' }
                    document.head.appendChild(script)
                }

                // Wait for window.turnstile to appear
                return new Promise<void>((resolve, reject) => {
                    let elapsed = 0
                    const check = () => {
                        if (cancelled) { reject(new Error('cancelled')); return }
                        if (window.turnstile) { resolve(); return }
                        elapsed += 150
                        if (elapsed > 15_000) { reject(new Error('timeout')); return }
                        timers.push(setTimeout(check, 150))
                    }
                    check()
                })
            }

            ensureScript()
                .then(() => { if (!cancelled) renderWidget() })
                .catch(() => { if (!cancelled) setScriptFailed(true) })

            return () => {
                cancelled = true
                timers.forEach(clearTimeout)
                removeWidget()
                callbacks.current.onSuccess('')
            }
        }, [siteKey, pathname])
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
                        justifyContent: 'center',
                        minHeight: '65px',
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
