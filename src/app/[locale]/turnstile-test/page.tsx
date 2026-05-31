/* eslint-disable react-hooks/set-state-in-effect -- temporary diagnostic page; all setState calls in effects are intentional live logging */
'use client'

import { useEffect, useRef, useState } from 'react'

export default function TurnstileTestPage() {
    const containerRef = useRef<HTMLDivElement>(null)
    const widgetIdRef = useRef<string | null>(null)
    const [status, setStatus] = useState<string[]>([])

    const log = (msg: string) => {
        const timestamp = new Date().toLocaleTimeString()
        setStatus(prev => [...prev, `[${timestamp}] ${msg}`])
        console.log(`[TurnstileTest] ${msg}`)
    }

    useEffect(() => {
        log('Component mounted')
        log(`window.turnstile exists: ${!!(window as any).turnstile}`)
        log(`Container ref exists: ${!!containerRef.current}`)

        const renderWidget = () => {
            const w = window as any
            if (!w.turnstile) {
                log('ERROR: window.turnstile is undefined')
                return
            }
            if (!containerRef.current) {
                log('ERROR: container ref is null')
                return
            }
            if (widgetIdRef.current) {
                try {
                    w.turnstile.remove(widgetIdRef.current)
                    log(`Removed previous widget: ${widgetIdRef.current}`)
                } catch (e) {
                    log(`Remove failed (OK if first render): ${e}`)
                }
            }
            try {
                const widgetId = w.turnstile.render(containerRef.current, {
                    sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!,
                    callback: (token: string) => {
                        log(`✅ TOKEN RECEIVED: ${token.substring(0, 20)}...`)
                    },
                    'error-callback': (err: any) => {
                        log(`❌ ERROR: ${err}`)
                    },
                    'expired-callback': () => {
                        log('⚠️ Token expired')
                    },
                })
                widgetIdRef.current = widgetId
                log(`✅ render() called — widget ID: ${widgetId}`)
                setTimeout(() => {
                    const iframe = containerRef.current?.querySelector('iframe')
                    log(`iframe injected: ${!!iframe}`)
                    if (iframe) log(`iframe src: ${iframe.src?.substring(0, 60)}...`)
                }, 2000)
            } catch (e) {
                log(`❌ render() threw: ${e}`)
            }
        }

        if ((window as any).turnstile) {
            renderWidget()
        } else {
            log('Waiting for turnstile script to load...')
            const interval = setInterval(() => {
                if ((window as any).turnstile) {
                    clearInterval(interval)
                    log('turnstile script loaded via polling')
                    renderWidget()
                }
            }, 500)
            const timeout = setTimeout(() => {
                clearInterval(interval)
                if (!(window as any).turnstile) {
                    log('❌ TIMEOUT: turnstile script never loaded after 10s')
                }
            }, 10000)
            return () => {
                clearInterval(interval)
                clearTimeout(timeout)
                log('Component unmounting — cleaning up')
                if (widgetIdRef.current && (window as any).turnstile) {
                    try {
                        (window as any).turnstile.remove(widgetIdRef.current)
                        log(`Removed widget on unmount: ${widgetIdRef.current}`)
                    } catch (e) {
                        log(`Cleanup remove failed: ${e}`)
                    }
                    widgetIdRef.current = null
                }
            }
        }

        return () => {
            log('Component unmounting — cleaning up')
            if (widgetIdRef.current && (window as any).turnstile) {
                try {
                    (window as any).turnstile.remove(widgetIdRef.current)
                    log(`Removed widget on unmount: ${widgetIdRef.current}`)
                } catch (e) {
                    log(`Cleanup remove failed: ${e}`)
                }
                widgetIdRef.current = null
            }
        }
    }, [])

    return (
        <div style={{ padding: 40, maxWidth: 600, margin: '0 auto' }}>
            <h1 style={{ color: '#fff', marginBottom: 20 }}>Turnstile Lifecycle Test</h1>

            <div style={{
                background: 'rgba(255,255,255,0.05)',
                border: '2px dashed rgba(255,255,255,0.2)',
                borderRadius: 12,
                padding: 20,
                marginBottom: 20,
                minHeight: 80,
            }}>
                <div ref={containerRef} id="turnstile-test-container" />
            </div>

            <div style={{
                background: 'rgba(0,0,0,0.5)',
                borderRadius: 8,
                padding: 16,
                fontFamily: 'monospace',
                fontSize: 12,
                color: '#0f0',
                maxHeight: 400,
                overflow: 'auto',
            }}>
                <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Diagnostic Log:</p>
                {status.map((line, i) => (
                    <div key={i} style={{
                        color: line.includes('ERROR') || line.includes('TIMEOUT') || line.includes('❌')
                            ? '#ff4444'
                            : line.includes('✅')
                                ? '#44ff44'
                                : line.includes('⚠️')
                                    ? '#ffaa00'
                                    : '#0f0',
                        marginBottom: 2,
                    }}>
                        {line}
                    </div>
                ))}
            </div>
        </div>
    )
}
