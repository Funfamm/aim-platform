'use client'

/**
 * ReactionOverlay — Floating emoji reactions for Watch Party
 * --------------------------------------------------------------------------
 * Renders emoji reactions that float up from the bottom of the video player.
 * Each reaction is positioned at a random horizontal offset (passed as `x` %).
 * Reactions are animated purely with CSS keyframes (no heavy libs).
 * Items auto-remove after 3.5s (controlled by WatchPartyShell state).
 */

interface Reaction {
    id:    string
    emoji: string
    x:     number // horizontal position 0-100 (percentage from left)
}

interface ReactionOverlayProps {
    reactions: Reaction[]
}

export default function ReactionOverlay({ reactions }: ReactionOverlayProps) {
    if (reactions.length === 0) return null

    return (
        <div
            aria-hidden="true"
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
                zIndex: 5,
            }}
        >
            <style>{`
                @keyframes reactionFloat {
                    0%   { opacity: 0;   transform: translateY(0) scale(0.5); }
                    15%  { opacity: 1;   transform: translateY(-20px) scale(1.2); }
                    70%  { opacity: 1;   transform: translateY(-120px) scale(1); }
                    100% { opacity: 0;   transform: translateY(-180px) scale(0.8); }
                }
                .reaction-item {
                    position: absolute;
                    bottom: 60px;
                    font-size: 1.8rem;
                    line-height: 1;
                    animation: reactionFloat 3.5s ease-out forwards;
                    will-change: transform, opacity;
                    filter: drop-shadow(0 0 8px rgba(0,0,0,0.6));
                    user-select: none;
                }
            `}</style>
            {reactions.map(r => (
                <span
                    key={r.id}
                    className="reaction-item"
                    style={{ left: `${r.x}%` }}
                >
                    {r.emoji}
                </span>
            ))}
        </div>
    )
}
