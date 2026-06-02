/**
 * Loading skeleton for locale routes.
 *
 * Matches the mobile hero card layout (dark background, same height and margins)
 * so the transition from loading → real page has no visible flash or layout jump.
 * Desktop shows a subtle centered shimmer on a full-height dark background.
 */

export default function Loading() {
    return (
        <>
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes loading-shimmer {
                    0% { opacity: 0.03; }
                    50% { opacity: 0.08; }
                    100% { opacity: 0.03; }
                }
            `}} />
            {/* Mobile: mimic the hero card dimensions & background */}
            <div style={{
                /* Match HomeHero mobile card exactly:
                   marginTop: 64px, marginLeft/Right: 12px, marginBottom: 8px,
                   height: calc(100dvh - 148px), borderRadius: 20px */
                marginTop: '64px',
                marginLeft: '12px',
                marginRight: '12px',
                marginBottom: '8px',
                height: 'calc(100dvh - 148px)',
                minHeight: '460px',
                maxHeight: '700px',
                borderRadius: '20px',
                overflow: 'hidden',
                background: '#0d0f14',
                position: 'relative',
            }}>
                {/* Cinematic gradient — same as hero overlay */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(135deg, #0a0c10 0%, #0d0f14 60%, #0f1118 100%)',
                }} />
                {/* Subtle shimmer pulse */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(ellipse at 50% 60%, rgba(212,168,83,0.06), transparent 70%)',
                    animation: 'loading-shimmer 2s ease-in-out infinite',
                }} />
            </div>
        </>
    )
}
