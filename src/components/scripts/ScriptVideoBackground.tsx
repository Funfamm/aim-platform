'use client'

import HeroBackground from '@/components/HeroBackground'
import { useIsMobile } from '@/hooks/useIsMobile'

/**
 * ScriptVideoBackground — fixed background for the Scripts page.
 *
 * Uses the shared HeroBackground component, which:
 *   1. Fetches ?type=background and ?type=hero-image (images — rotate every 6 s, NextImage optimised)
 *   2. Falls back to ?type=hero-video (dual-slot crossfade) when no images exist
 *   3. Filters by device target (mobile | desktop | all) automatically
 *   4. Prevents horizontal scroll on mobile via maxWidth:100vw + overflow:hidden
 */
export default function ScriptVideoBackground() {
    const isMobile = useIsMobile()
    return (
        <HeroBackground
            page="scripts"
            isMobile={isMobile}
        />
    )
}
