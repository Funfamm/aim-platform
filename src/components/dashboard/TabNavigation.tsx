'use client'

import { useRef, useState, useEffect } from 'react'
import ScrollReveal3D from '@/components/ScrollReveal3D'

export type TabType = 'applications' | 'watchlist' | 'activity' | 'donations' | 'profile'

interface TabNavigationProps {
    activeTab: TabType
    onTabChange: (tab: TabType) => void
    tabs: { key: TabType; label: string; icon: string; count?: number }[]
}

export default function TabNavigation({ activeTab, onTabChange, tabs }: TabNavigationProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
    const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

    // Update sliding indicator position
    useEffect(() => {
        const activeEl = tabRefs.current.get(activeTab)
        if (activeEl && scrollRef.current) {
            const containerRect = scrollRef.current.getBoundingClientRect()
            const tabRect = activeEl.getBoundingClientRect()
            setIndicatorStyle({
                left: tabRect.left - containerRect.left + scrollRef.current.scrollLeft,
                width: tabRect.width,
            })
            // Scroll active tab into view
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
        }
    }, [activeTab])

    return (
        <ScrollReveal3D direction="up" delay={200} distance={20}>
            <style>{`
                .dash-tabs-scroll {
                    display: flex;
                    gap: 4px;
                    overflow-x: auto;
                    overflow-y: hidden;
                    -webkit-overflow-scrolling: touch;
                    scrollbar-width: none;
                    -ms-overflow-style: none;
                    scroll-behavior: smooth;
                    position: relative;
                    padding-bottom: 2px;
                }
                .dash-tabs-scroll::-webkit-scrollbar { display: none; }
                .dash-tab-btn {
                    padding: 0.65rem 1.1rem;
                    background: none;
                    border: none;
                    color: var(--text-tertiary);
                    font-size: 0.82rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: color 0.25s ease, background 0.25s ease;
                    white-space: nowrap;
                    display: flex;
                    align-items: center;
                    gap: 7px;
                    border-radius: var(--radius-md) var(--radius-md) 0 0;
                    position: relative;
                    flex-shrink: 0;
                }
                .dash-tab-btn:hover {
                    color: var(--text-secondary);
                    background: var(--bg-glass-light);
                }
                .dash-tab-btn.active {
                    color: var(--accent-gold);
                }
                .dash-tab-indicator {
                    position: absolute;
                    bottom: 0;
                    height: 2px;
                    background: var(--accent-gold);
                    border-radius: 2px 2px 0 0;
                    transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 0 8px rgba(212,168,83,0.4);
                }
                .dash-tab-badge {
                    font-size: 0.62rem;
                    padding: 1px 7px;
                    border-radius: var(--radius-full);
                    font-weight: 700;
                    min-width: 18px;
                    text-align: center;
                    transition: all 0.25s ease;
                    line-height: 1.4;
                }
                @media (max-width: 600px) {
                    .dash-tab-btn {
                        padding: 0.55rem 0.85rem;
                        font-size: 0.78rem;
                        gap: 5px;
                    }
                    .dash-tab-label { display: none; }
                    .dash-tab-btn { font-size: 1.1rem; }
                }
            `}</style>

            <div className="glass-panel" style={{
                position: 'relative',
                marginBottom: 'var(--space-xl)',
                borderRadius: 'var(--radius-lg)',
                padding: '0 4px',
            }}>
                <div className="dash-tabs-scroll" ref={scrollRef}>
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            ref={(el) => { if (el) tabRefs.current.set(tab.key, el) }}
                            onClick={() => onTabChange(tab.key)}
                            className={`dash-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                        >
                            <span>{tab.icon}</span>
                            <span className="dash-tab-label">{tab.label}</span>
                            {tab.count !== undefined && (
                                <span className="dash-tab-badge" style={{
                                    background: activeTab === tab.key ? 'rgba(212,168,83,0.18)' : 'rgba(255,255,255,0.05)',
                                    color: activeTab === tab.key ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                                }}>{tab.count}</span>
                            )}
                        </button>
                    ))}
                    {/* Sliding indicator */}
                    <div className="dash-tab-indicator" style={{
                        left: indicatorStyle.left,
                        width: indicatorStyle.width,
                    }} />
                </div>
            </div>
        </ScrollReveal3D>
    )
}
