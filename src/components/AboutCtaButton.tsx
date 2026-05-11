'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * Client-side CTA button that checks auth state after hydration.
 * Renders "/register" by default (matches server-rendered HTML),
 * then swaps to "/dashboard" if the user is logged in.
 * This allows the About page to use ISR caching.
 */
export default function AboutCtaButton({ label, style }: { label: string; style?: React.CSSProperties }) {
    const [href, setHref] = useState('/register')

    useEffect(() => {
        fetch('/api/auth/me', { credentials: 'include' })
            .then(r => { if (!r.ok) throw new Error(); return r.json() })
            .then(data => { if (data?.user?.id) setHref('/dashboard') })
            .catch(() => { /* stay on /register */ })
    }, [])

    return (
        <Link href={href} className="btn btn-primary" style={style}>
            {label}
        </Link>
    )
}
