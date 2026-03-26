'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminVideosRedirect() {
    const router = useRouter()
    useEffect(() => {
        router.replace('/admin/media')
    }, [router])
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-tertiary)' }}>
            Redirecting to Media Manager...
        </div>
    )
}
