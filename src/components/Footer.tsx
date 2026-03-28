'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import SubscribeForm from './SubscribeForm'
import { useTranslations } from 'next-intl'

interface FooterSponsor {
    id: string; name: string; logoUrl: string | null; website: string | null; tier: string
}

export default function Footer() {
    const [brand, setBrand] = useState({ name: 'AIM Studio', social: { youtube: '', instagram: '', x: '' } })
    const [footerSponsors, setFooterSponsors] = useState<FooterSponsor[]>([])
    const t = useTranslations('footer')

    useEffect(() => {
        fetch('/api/site-settings')
            .then(r => r.json())
            .then(data => {
                const name = data.siteName || 'AIM Studio'
                let social = { youtube: '', instagram: '', x: '' }
                try { social = { ...social, ...JSON.parse(data.socialLinks || '{}') } } catch { /* */ }
                setBrand({ name, social })
            })
            .catch(() => { /* */ })
    }, [])

    useEffect(() => {
        fetch('/api/sponsors?location=footer')
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                if (Array.isArray(data)) setFooterSponsors(data)
            })
            .catch(() => { /* */ })
    }, [])

    return (
        <footer className="footer" aria-label="Site footer">
            {/* Footer Sponsor Strip */}
            

            <div className="container">
                <div className="footer-inner footer-responsive-grid" style={{
                    gap: 'var(--space-2xl)',
                    marginBottom: 'var(--space-2xl)',
                }}>
                    {/* Brand */}
                    <div className="footer-brand">
                        <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                            <h3>
                                <span style={{ color: 'var(--accent-gold)' }}>{brand.name.split(' ')[0]}</span> {brand.name.split(' ').slice(1).join(' ')}
                            </h3>
                        </Link>
                        <p>
                            {t('tagline')}
                        </p>
                    </div>

                    {/* Explore */}
                    <div className="footer-col">
                        <h4>{t('explore')}</h4>
                        <ul>
                            <li><Link href="/works">{t('ourWorks')}</Link></li>
                            <li><Link href="/upcoming">{t('comingSoon')}</Link></li>
                            <li><Link href="/casting">{t('castingCalls')}</Link></li>
                            <li><Link href="/about">{t('about')}</Link></li>
                        </ul>
                    </div>

                    {/* Support */}
                    <div className="footer-col">
                        <h4>{t('support')}</h4>
                        <ul>
                            <li><Link href="/donate">{t('donateLink')}</Link></li>
                            <li><Link href="/contact">{t('contact')}</Link></li>
                        </ul>
                    </div>

                    {/* Newsletter */}
                    <div className="footer-col">
                        <h4>{t('stayUpdated')}</h4>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-sm)', lineHeight: 1.5 }}>
                            {t('newsletterText')}
                        </p>
                        <SubscribeForm />
                    </div>
                </div>

                <div className="footer-bottom">
                    <span>&copy; {new Date().getFullYear()} {brand.name}. {t('rights')}</span>
                    <div className="footer-social">
                        <a href={brand.social.youtube || 'https://youtube.com'} target="_blank" rel="noopener" aria-label="YouTube">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
                        </a>
                        <a href={brand.social.instagram || 'https://instagram.com'} target="_blank" rel="noopener" aria-label="Instagram">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>
                        </a>
                        <a href={brand.social.x || 'https://x.com'} target="_blank" rel="noopener" aria-label="X">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    )
}


