'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { usePathname } from 'next/navigation'

interface NotificationItem {
    id: string
    type: string
    title: string
    message: string
    link?: string
    read: boolean
    createdAt: string
}

interface NotificationContextValue {
    unreadCount: number
    refresh: () => void
    markAllRead: () => void
    /** New notification pushed by polling — the notifications page subscribes to this */
    newNotification: NotificationItem | null
    /** Clear after the notifications page has consumed the new notification */
    clearNewNotification: () => void
}

const NotificationContext = createContext<NotificationContextValue>({
    unreadCount: 0,
    refresh: () => {},
    markAllRead: () => {},
    newNotification: null,
    clearNewNotification: () => {},
})

/** Play a subtle chime sound for new messages on the notifications page */
function playMessageSound() {
    try {
        const audio = new Audio('/sounds/message.mp3')
        audio.volume = 0.4
        audio.play().catch(() => {})
    } catch { /* browser may block — non-critical */ }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()
    const pathname = usePathname()
    const [unreadCount, setUnreadCount] = useState(0)
    const [newNotification, setNewNotification] = useState<NotificationItem | null>(null)

    // Track whether the user is currently on the notifications page
    const isOnNotificationsPage = pathname?.includes('/notifications') ?? false

    // Track the latest known notification ID to detect new arrivals
    const latestKnownIdRef = useRef<string | null>(null)
    // Track whether the user is on the notifications page (ref for use in callbacks)
    const isOnNotificationsPageRef = useRef(isOnNotificationsPage)
    isOnNotificationsPageRef.current = isOnNotificationsPage

    const refresh = useCallback(async () => {
        if (!user) return
        try {
            // When on notifications page, fetch latest notification to detect new arrivals
            // Otherwise just fetch count for the badge
            const limit = isOnNotificationsPageRef.current ? 3 : 1
            const res = await fetch(`/api/notifications?limit=${limit}`)
            const data = await res.json()
            const serverUnread = data.unreadCount ?? 0
            const notifications: NotificationItem[] = data.notifications ?? []

            if (isOnNotificationsPageRef.current) {
                // User is on the notifications page — detect NEW notifications
                if (notifications.length > 0) {
                    const latestId = notifications[0].id
                    if (latestKnownIdRef.current && latestId !== latestKnownIdRef.current) {
                        // A new notification arrived — push it to the feed + play sound
                        // Only push notifications we haven't seen before
                        const newOnes = notifications.filter(
                            n => !latestKnownIdRef.current || n.id > latestKnownIdRef.current
                        )
                        if (newOnes.length > 0) {
                            setNewNotification(newOnes[0])
                            playMessageSound()
                        }
                    }
                    latestKnownIdRef.current = latestId
                }
                // Don't increment the bell badge while on the page —
                // the user is already seeing notifications live
            } else {
                // User is NOT on the notifications page — normal bell badge behavior
                setUnreadCount(serverUnread)
                // Update latestKnownId so we don't false-trigger when they return
                if (notifications.length > 0) {
                    latestKnownIdRef.current = notifications[0].id
                }
            }
        } catch { /* silently fail */ }
    }, [user])

    const markAllRead = useCallback(() => setUnreadCount(0), [])
    const clearNewNotification = useCallback(() => setNewNotification(null), [])

    // Poll every 15s when logged in
    useEffect(() => {
        if (!user) { queueMicrotask(() => setUnreadCount(0)); return }
        queueMicrotask(() => refresh())
        const id = setInterval(refresh, 15_000)
        return () => clearInterval(id)
    }, [user, refresh])

    return (
        <NotificationContext.Provider value={{ unreadCount, refresh, markAllRead, newNotification, clearNewNotification }}>
            {children}
        </NotificationContext.Provider>
    )
}

export const useNotifications = () => useContext(NotificationContext)
