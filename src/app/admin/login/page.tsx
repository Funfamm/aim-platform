'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Admin login page is deprecated — redirect to unified login
export default function AdminLoginPage() {
    const router = useRouter()

    useEffect(() => {
        router.replace('/login')
    }, [router])

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-primary)', color: 'var(--text-tertiary)', fontSize: '0.9rem',
        }}>
            Redirecting to login...
        </div>
    )
}
