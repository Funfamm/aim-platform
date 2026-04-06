'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'

/**
 * Shared hook to track unread notification count.
 * Used by both the NotificationBell (desktop) and the Navbar hamburger (mobile).
 */
export function useUnreadNotifications() {
    const { user } = useAuth()
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(false)

    const fetchUnreadCount = useCallback(async () => {
        if (!user) return
        setLoading(true)
        try {
            // We only need the unreadCount, so we set limit=1 to minimize data
            const res = await fetch('/api/notifications?limit=1')
            if (res.ok) {
                const data = await res.json()
                setUnreadCount(data.unreadCount ?? 0)
            }
        } catch (err) {
            console.error('[useUnreadNotifications] Failed to fetch:', err)
        } finally {
            setLoading(false)
        }
    }, [user])

    // Initial fetch and polling
    useEffect(() => {
        if (!user) {
            setUnreadCount(0)
            return
        }

        fetchUnreadCount()

        // Poll every 60 seconds to keep the count fresh across components
        const interval = setInterval(fetchUnreadCount, 60000)
        return () => clearInterval(interval)
    }, [user, fetchUnreadCount])

    return {
        unreadCount,
        setUnreadCount, // Allow manual updates (e.g. after marking as read)
        refresh: fetchUnreadCount,
        loading
    }
}
