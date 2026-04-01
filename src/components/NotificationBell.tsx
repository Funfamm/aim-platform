'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import styles from './NotificationBell.module.css'

interface Notification {
    id: string
    type: string
    title: string
    message: string
    link?: string
    read: boolean
    createdAt: string
}

const TYPE_ICONS: Record<string, string> = {
    new_role: '🎭',
    announcement: '📣',
    content_publish: '✨',
    status_change: '📋',
    system: '⚙️',
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}

export function NotificationBell() {
    const { user } = useAuth()
    const router = useRouter()
    const t = useTranslations('notificationBell')
    const [open, setOpen] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [loading, setLoading] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const fetchNotifications = useCallback(async () => {
        if (!user) return
        setLoading(true)
        try {
            const res = await fetch('/api/notifications?limit=15')
            const data = await res.json()
            setNotifications(data.notifications ?? [])
            setUnreadCount(data.unreadCount ?? 0)
        } catch { /* silently fail */ }
        finally { setLoading(false) }
    }, [user])

    // Poll every 60 seconds for unread count
    useEffect(() => {
        if (!user) return
        fetchNotifications()
        const interval = setInterval(fetchNotifications, 60_000)
        return () => clearInterval(interval)
    }, [user, fetchNotifications])

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    async function markAllRead() {
        await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
        setNotifications(n => n.map(x => ({ ...x, read: true })))
        setUnreadCount(0)
    }

    async function handleNotificationClick(n: Notification) {
        if (!n.read) {
            await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [n.id] }) })
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
            setUnreadCount(c => Math.max(0, c - 1))
        }
        if (n.link) {
            setOpen(false)
            router.push(n.link)
        }
    }

    if (!user) return null

    return (
        <div className={styles.wrapper} ref={dropdownRef}>
            <button
                id="notification-bell-btn"
                className={styles.bellBtn}
                onClick={() => { setOpen(o => !o); if (!open) fetchNotifications() }}
                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                    <span className={styles.badge} aria-hidden="true">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className={styles.dropdown} role="dialog" aria-label="Notifications">
                    <div className={styles.dropdownHeader}>
                        <span className={styles.dropdownTitle}>{t('title')}</span>
                        {unreadCount > 0 && (
                            <button className={styles.markAllBtn} onClick={markAllRead}>
                                {t('markAllRead')}
                            </button>
                        )}
                    </div>

                    <div className={styles.list}>
                        {loading && notifications.length === 0 && (
                            <div className={styles.empty}>{t('loading')}</div>
                        )}
                        {!loading && notifications.length === 0 && (
                            <div className={styles.empty}>{t('allCaughtUp')}</div>
                        )}
                        {notifications.map(n => (
                            <button
                                key={n.id}
                                className={`${styles.item} ${!n.read ? styles.unread : ''}`}
                                onClick={() => handleNotificationClick(n)}
                            >
                                <span className={styles.itemIcon}>{TYPE_ICONS[n.type] ?? '🔔'}</span>
                                <span className={styles.itemBody}>
                                    <span className={styles.itemTitle}>{n.title}</span>
                                    <span className={styles.itemMessage}>{n.message}</span>
                                    <span className={styles.itemTime}>{timeAgo(n.createdAt)}</span>
                                </span>
                                {!n.read && <span className={styles.dot} aria-hidden="true" />}
                            </button>
                        ))}
                    </div>

                    <div className={styles.dropdownFooter}>
                        <button className={styles.prefsLink} onClick={() => { setOpen(false); router.push('/notifications') }}>
                            {t('managePrefsArrow')} {t('managePrefs')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
