'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import AdminSidebar from '@/components/AdminSidebar'
import Link from 'next/link'
import ComposeTab from './ComposeTab'
import SurveyResultsTab from './SurveyResultsTab'
import HistoryTab from './HistoryTab'

type Tab = 'compose' | 'results' | 'history'

function OutreachContent() {
    const params = useSearchParams()
    const initial = (params.get('tab') as Tab) || 'compose'
    const [tab, setTab] = useState<Tab>(initial)

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
                <div style={{
                    display: 'flex', gap: '4px', marginBottom: '24px',
                    padding: '4px', borderRadius: '12px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border-subtle)',
                    position: 'sticky', top: 0, zIndex: 10,
                    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
                }}>
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            style={{
                                flex: 1, padding: '10px 16px', borderRadius: '10px',
                                border: 'none', cursor: 'pointer',
                                fontSize: '0.82rem', fontWeight: tab === t.key ? 700 : 500,
                                background: tab === t.key ? 'rgba(212,168,83,0.12)' : 'transparent',
                                color: tab === t.key ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                transition: 'all 0.15s',
                            }}
                        >
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'compose' && <ComposeTab />}
                {tab === 'results' && <SurveyResultsTab />}
                {tab === 'history' && <HistoryTab />}
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
