'use client'

import './outreach.css'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import AdminSidebar from '@/components/AdminSidebar'
import Link from 'next/link'
import ComposeTab from './ComposeTab'
import SurveyResultsTab from './SurveyResultsTab'
import HistoryTab, { type ReuseData } from './HistoryTab'

type Tab = 'compose' | 'results' | 'history'

function OutreachContent() {
    const params = useSearchParams()
    const initial = (params.get('tab') as Tab) || 'compose'
    const [tab, setTab] = useState<Tab>(initial)
    const [reuseData, setReuseData] = useState<ReuseData | null>(null)

    // Check if Compose tab has unsaved content
    const isComposeDirty = useCallback((): boolean => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const check = (window as any).__outreachComposeDirty
        return typeof check === 'function' ? check() : false
    }, [])

    // Guard tab switch — prompt if leaving compose with content
    const handleTabSwitch = useCallback((newTab: Tab) => {
        if (tab === 'compose' && newTab !== 'compose' && isComposeDirty()) {
            if (!window.confirm('You have unsaved draft content. Switch tabs anyway?')) return
        }
        setTab(newTab)
    }, [tab, isComposeDirty])

    // Handle reuse from history — load data and switch to compose tab
    const handleReuse = useCallback((data: ReuseData) => {
        setReuseData(data)
        setTab('compose')
    }, [])

    // Guard browser navigation (close/refresh)
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (tab === 'compose' && isComposeDirty()) {
                e.preventDefault()
            }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [tab, isComposeDirty])

    const tabs: { key: Tab; icon: string; label: string }[] = [
        { key: 'compose', icon: '📝', label: 'Compose' },
        { key: 'results', icon: '📊', label: 'Survey Results' },
        { key: 'history', icon: '📜', label: 'History' },
    ]

    return (
        <div className="admin-layout">
            <AdminSidebar />
            <main className="admin-main" style={{ maxWidth: 900 }}>

                <Link href="/admin" style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '20px' }}>
                    ← Admin Dashboard
                </Link>

                <div style={{ marginBottom: '24px' }}>
                    <h1 style={{ fontSize: 'clamp(1.3rem, 3vw, 1.8rem)', fontWeight: 800, marginBottom: '6px' }}>
                        📡 Outreach Center
                    </h1>
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                        Compose and send announcements, surveys, and campaigns — all in one place.
                    </p>
                </div>

                {/* Tab bar */}
                <div role="tablist" aria-label="Outreach Center tabs" className="outreachTabBar">
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            role="tab"
                            id={`outreach-tab-${t.key}`}
                            aria-selected={tab === t.key}
                            aria-controls={`outreach-panel-${t.key}`}
                            onClick={() => handleTabSwitch(t.key)}
                            className="outreachTabBtn"
                            data-active={tab === t.key}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                <div role="tabpanel" id={`outreach-panel-${tab}`} aria-labelledby={`outreach-tab-${tab}`}>
                    {tab === 'compose' && <ComposeTab initialData={reuseData} />}
                    {tab === 'results' && <SurveyResultsTab />}
                    {tab === 'history' && <HistoryTab onReuse={handleReuse} />}
                </div>
            </main>
        </div>
    )
}

export default function OutreachPage() {
    return (
        <Suspense fallback={<div className="admin-layout"><AdminSidebar /><main className="admin-main"><div className="loading-spinner" style={{ margin: '60px auto', width: 28, height: 28 }} /></main></div>}>
            <OutreachContent />
        </Suspense>
    )
}

