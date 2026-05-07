'use client'
// Thin client-component wrapper so ssr:false can be used legally.
// Server Components cannot use dynamic(..., { ssr: false }) directly.
import dynamic from 'next/dynamic'

const Scene3D = dynamic(() => import('@/components/Scene3D'), {
    ssr: false,
    loading: () => null,
})

export default function Scene3DClient() {
    return <Scene3D />
}
