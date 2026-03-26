'use client'

import Image from 'next/image'
import ScrollReveal3D from '@/components/ScrollReveal3D'
import { useTranslations } from 'next-intl'

interface DashboardHeaderProps {
    userName: string
    bannerUrl: string | null
}

export default function DashboardHeader({ userName, bannerUrl }: DashboardHeaderProps) {
    const t = useTranslations('dashboardHeader')
    return (
        <ScrollReveal3D direction="up" distance={30}>
            <div style={{
                marginBottom: 'var(--space-2xl)', position: 'relative',
                borderRadius: 'var(--radius-xl)', overflow: 'hidden',
                minHeight: bannerUrl ? '160px' : 'auto',
            }}>
                {/* Banner Image — Next.js optimized */}
                {bannerUrl && (
                    <Image
                        src={bannerUrl}
                        alt="Dashboard banner"
                        fill
                        sizes="900px"
                        priority
                        style={{
                            objectFit: 'cover', objectPosition: 'center',
                            filter: 'brightness(0.45) blur(0.5px)',
                            zIndex: 0,
                        }}
                    />
                )}
                {/* Gradient overlay */}
                {bannerUrl && (
                    <div style={{
                        position: 'absolute', inset: 0, zIndex: 1,
                        background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 100%)',
                    }} />
                )}
                {/* Content */}
                <div style={{
                    position: 'relative', zIndex: 2,
                    padding: bannerUrl ? '40px 24px 20px' : '0',
                }}>
                    <span className="text-label">{t('label')}</span>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, marginBottom: 'var(--space-sm)' }}>
                        {t('welcome')} <span style={{ color: 'var(--accent-gold)' }}>{userName.split(' ')[0]}</span>
                    </h1>
                    <p style={{ color: bannerUrl ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                        {t('description')}
                    </p>
                </div>
            </div>
        </ScrollReveal3D>
    )
}
