'use client'

import { useIsMobile } from '@/hooks/useIsMobile'
import MobileCardCarousel from '@/components/MobileCardCarousel'
import MobileScriptCard, { type ScriptCallCardItem } from '@/components/MobileScriptCard'

interface Props {
    calls: ScriptCallCardItem[]
    isLoggedIn: boolean
}

/**
 * Mobile-only overlay for the Scripts page hero section.
 * Renders a full-bleed snap-scroll carousel of open script call cards.
 *
 * Desktop: returns null — the existing ScriptVideoBackground + hero content handles it.
 * Mobile, no calls: returns null — the existing CSS-media-query mobile card handles it
 *   (ScriptVideoBackground in cardMode shows a static image, no fake CTA).
 * Mobile, calls exist: renders an absolute overlay covering the existing hero content.
 */
export default function ScriptsMobileHero({ calls, isLoggedIn }: Props) {
    const isMobile = useIsMobile()

    if (!isMobile || calls.length === 0) return null

    return (
        // Absolute fill — sits on top of ScriptVideoBackground + existing hero content.
        // The parent .scripts-hero-section already has overflow:hidden + border-radius on mobile,
        // so no need to repeat those here.
        <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 10,
        }}>
            <MobileCardCarousel autoRotateMs={5000}>
                {calls.map((call, i) => (
                    <MobileScriptCard
                        key={call.id}
                        call={call}
                        isLoggedIn={isLoggedIn}
                        priority={i === 0}
                    />
                ))}
            </MobileCardCarousel>
        </div>
    )
}
