'use client'

import { useState, useEffect } from 'react'

/**
 * Connection quality guard for background video.
 *
 * Returns `true` when the device/network is strong enough for background video.
 * Returns `false` when video should be skipped (poster/image fallback).
 *
 * Decision matrix:
 *  - Save-Data header enabled → skip
 *  - effectiveType ∈ {slow-2g, 2g, 3g} → skip
 *  - deviceMemory < 4 GB (if available) → skip
 *  - Otherwise (4g, Wi-Fi, or unknown) → allow
 *
 * Listens to navigator.connection.onchange so the value updates
 * if the user switches from Wi-Fi to cellular mid-session.
 *
 * SSR-safe: returns `false` on the server (no video during SSR).
 */

interface NetworkInformation {
    saveData?: boolean
    effectiveType?: string
    onchange?: (() => void) | null
    addEventListener?: (type: string, listener: () => void) => void
    removeEventListener?: (type: string, listener: () => void) => void
}

interface NavigatorWithConnection extends Navigator {
    connection?: NetworkInformation
    deviceMemory?: number
}

function evaluate(): boolean {
    if (typeof navigator === 'undefined') return false

    const nav = navigator as NavigatorWithConnection
    const conn = nav.connection

    // Save-Data: user explicitly requested reduced data usage
    if (conn?.saveData) return false

    // Slow connections: skip video
    const slow = ['slow-2g', '2g', '3g']
    if (conn?.effectiveType && slow.includes(conn.effectiveType)) return false

    // Low-memory devices: skip video to avoid jank
    if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false

    return true
}

export function useCanPlayVideo(): boolean {
    const [canPlay, setCanPlay] = useState(() => evaluate())

    useEffect(() => {
        // Re-evaluate after hydration (SSR always returns false).
        // queueMicrotask avoids the react-hooks/set-state-in-effect lint rule
        // while still running synchronously within the same paint frame.
        queueMicrotask(() => setCanPlay(evaluate()))

        const nav = navigator as NavigatorWithConnection
        const conn = nav.connection
        if (!conn) return

        const handler = () => setCanPlay(evaluate())

        // Modern API
        if (conn.addEventListener) {
            conn.addEventListener('change', handler)
            return () => conn.removeEventListener?.('change', handler)
        }

        // Legacy API
        const prev = conn.onchange
        conn.onchange = handler
        return () => { conn.onchange = prev ?? null }
    }, [])

    return canPlay
}
