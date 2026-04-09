'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useAuth } from '@/components/AuthProvider'

interface NotificationContextValue {
    unreadCount: number
    refresh: () => void
    markAllRead: () => void
}

const NotificationContext = createContext<NotificationContextValue>({
    unreadCount: 0,
    refresh: () => {},
    markAllRead: () => {},
})

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()
    const [unreadCount, setUnreadCount] = useState(0)

    const refresh = useCallback(async () => {
        if (!user) return
        try {
            const res = await fetch('/api/notifications?limit=1')
            const data = await res.json()
            setUnreadCount(data.unreadCount ?? 0)
        } catch { /* silently fail */ }
    }, [user])

    const markAllRead = useCallback(() => setUnreadCount(0), [])

    // Poll every 60 s when logged in
    useEffect(() => {
        if (!user) { queueMicrotask(() => setUnreadCount(0)); return }
        queueMicrotask(() => refresh())
        const id = setInterval(refresh, 60_000)
        return () => clearInterval(id)
    }, [user, refresh])

    return (
        <NotificationContext.Provider value={{ unreadCount, refresh, markAllRead }}>
            {children}
        </NotificationContext.Provider>
    )
}

export const useNotifications = () => useContext(NotificationContext)
