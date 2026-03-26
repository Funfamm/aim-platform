'use client'

import ScrollReveal3D from '@/components/ScrollReveal3D'

export type TabType = 'applications' | 'watchlist' | 'activity' | 'donations' | 'profile'

interface TabNavigationProps {
    activeTab: TabType
    onTabChange: (tab: TabType) => void
    tabs: { key: TabType; label: string; icon: string; count?: number }[]
}

export default function TabNavigation({ activeTab, onTabChange, tabs }: TabNavigationProps) {
    return (
        <ScrollReveal3D direction="up" delay={200} distance={20}>
            <div style={{
                display: 'flex', gap: '2px', marginBottom: 'var(--space-xl)',
                borderBottom: '1px solid var(--border-subtle)', overflowX: 'auto',
            }}>
                {tabs.map((tab) => (
                    <button key={tab.key} onClick={() => onTabChange(tab.key)} style={{
                        padding: '0.6rem 1rem', background: 'none', border: 'none',
                        borderBottom: activeTab === tab.key ? '2px solid var(--accent-gold)' : '2px solid transparent',
                        color: activeTab === tab.key ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                        fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.2s', marginBottom: '-1px', whiteSpace: 'nowrap',
                        display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                        {tab.icon} {tab.label}
                        {tab.count !== undefined && (
                            <span style={{
                                fontSize: '0.65rem', padding: '1px 6px', borderRadius: 'var(--radius-full)',
                                background: activeTab === tab.key ? 'rgba(212,168,83,0.15)' : 'rgba(255,255,255,0.05)',
                                color: activeTab === tab.key ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                            }}>{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>
        </ScrollReveal3D>
    )
}
