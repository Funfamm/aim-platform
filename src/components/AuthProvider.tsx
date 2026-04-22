'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

interface User {
    id: string
    name: string
    email: string
    avatar: string | null
    bannerUrl: string | null
    role: 'member' | 'admin' | 'superadmin'
    hasPassword?: boolean
    authProvider?: 'google' | 'apple' | 'credentials'
    accentColor?: string
}

interface AuthContextType {
    user: User | null
    loading: boolean
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string; redirectTo?: string }>
    register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
    logout: () => Promise<void>
    refreshUser: () => Promise<void>
}

// ── Accent colour definitions (must match ProfileTab.tsx & layout.tsx) ──
const ACCENT_COLORS: Record<string, { base: string; light: string; dark: string; glow: string; glowStrong: string; lift: string }> = {
    gold:     { base: '#e4b95a', light: '#f5dfa0', dark: '#b8922e', glow: 'rgba(228,185,90,0.15)', glowStrong: 'rgba(228,185,90,0.25)', lift: '0 8px 30px rgba(228,185,90,0.25),0 2px 8px rgba(228,185,90,0.15)' },
    silver:   { base: '#c8c8d4', light: '#e8e8f0', dark: '#8888a0', glow: 'rgba(200,200,212,0.15)', glowStrong: 'rgba(200,200,212,0.25)', lift: '0 8px 30px rgba(200,200,212,0.25),0 2px 8px rgba(200,200,212,0.15)' },
    ember:    { base: '#f06b47', light: '#f9a88e', dark: '#b84820', glow: 'rgba(240,107,71,0.15)', glowStrong: 'rgba(240,107,71,0.25)', lift: '0 8px 30px rgba(240,107,71,0.25),0 2px 8px rgba(240,107,71,0.15)' },
    jade:     { base: '#34d399', light: '#6ee7b7', dark: '#059669', glow: 'rgba(52,211,153,0.15)', glowStrong: 'rgba(52,211,153,0.25)', lift: '0 8px 30px rgba(52,211,153,0.25),0 2px 8px rgba(52,211,153,0.15)' },
    azure:    { base: '#60a5fa', light: '#93c5fd', dark: '#2563eb', glow: 'rgba(96,165,250,0.15)', glowStrong: 'rgba(96,165,250,0.25)', lift: '0 8px 30px rgba(96,165,250,0.25),0 2px 8px rgba(96,165,250,0.15)' },
    rose:     { base: '#f472b6', light: '#f9a8d4', dark: '#db2777', glow: 'rgba(244,114,182,0.15)', glowStrong: 'rgba(244,114,182,0.25)', lift: '0 8px 30px rgba(244,114,182,0.25),0 2px 8px rgba(244,114,182,0.15)' },
    violet:   { base: '#a78bfa', light: '#c4b5fd', dark: '#7c3aed', glow: 'rgba(167,139,250,0.15)', glowStrong: 'rgba(167,139,250,0.25)', lift: '0 8px 30px rgba(167,139,250,0.25),0 2px 8px rgba(167,139,250,0.15)' },
    copper:   { base: '#d4956a', light: '#e8b896', dark: '#a0623a', glow: 'rgba(212,149,106,0.15)', glowStrong: 'rgba(212,149,106,0.25)', lift: '0 8px 30px rgba(212,149,106,0.25),0 2px 8px rgba(212,149,106,0.15)' },
    platinum: { base: '#e2e8f0', light: '#f1f5f9', dark: '#94a3b8', glow: 'rgba(226,232,240,0.15)', glowStrong: 'rgba(226,232,240,0.25)', lift: '0 8px 30px rgba(226,232,240,0.25),0 2px 8px rgba(226,232,240,0.15)' },
    crimson:  { base: '#ef4444', light: '#f87171', dark: '#b91c1c', glow: 'rgba(239,68,68,0.15)', glowStrong: 'rgba(239,68,68,0.25)', lift: '0 8px 30px rgba(239,68,68,0.25),0 2px 8px rgba(239,68,68,0.15)' },
}

/** Apply accent colour CSS variables to the document root */
function applyAccentVars(key: string) {
    const a = ACCENT_COLORS[key] ?? ACCENT_COLORS.gold
    const r = document.documentElement.style
    r.setProperty('--accent-gold', a.base)
    r.setProperty('--accent-gold-light', a.light)
    r.setProperty('--accent-gold-dark', a.dark)
    r.setProperty('--accent-gold-glow', a.glow)
    r.setProperty('--accent-cream', a.dark)
    r.setProperty('--text-accent', a.base)
    r.setProperty('--border-accent', `${a.base}55`)
    r.setProperty('--border-glow', `${a.base}80`)
    r.setProperty('--shadow-glow', `0 0 40px ${a.glow}`)
    r.setProperty('--shadow-glow-strong', `0 0 80px ${a.glowStrong}`)
    r.setProperty('--shadow-gold-lift', a.lift)
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    const refreshUser = useCallback(async () => {
        try {
            const res = await fetch('/api/auth/me')
            if (res.ok) {
                const data = await res.json()
                setUser(data.user)

                // Apply saved accent colour immediately on login / refresh
                if (data.user?.accentColor && ACCENT_COLORS[data.user.accentColor]) {
                    localStorage.setItem('aim-accent', data.user.accentColor)
                    applyAccentVars(data.user.accentColor)
                }
            } else {
                setUser(null)
            }
        } catch {
            setUser(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        refreshUser()
    }, [refreshUser])

    const login = async (email: string, password: string) => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })
            const data = await res.json()
            if (res.ok) {
                setUser(data.user)

                // Apply accent from login response immediately
                if (data.user?.accentColor && ACCENT_COLORS[data.user.accentColor]) {
                    localStorage.setItem('aim-accent', data.user.accentColor)
                    applyAccentVars(data.user.accentColor)
                }

                return { success: true, redirectTo: data.redirectTo }
            }
            return { success: false, error: data.error || 'Login failed' }
        } catch {
            return { success: false, error: 'Network error' }
        }
    }

    const register = async (name: string, email: string, password: string) => {
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            })
            const data = await res.json()
            if (res.ok) {
                setUser(data.user)
                return { success: true }
            }
            return { success: false, error: data.error || 'Registration failed' }
        } catch {
            return { success: false, error: 'Network error' }
        }
    }

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        setUser(null)

        // Reset accent colour to default gold & clear localStorage
        localStorage.removeItem('aim-accent')
        applyAccentVars('gold')
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
