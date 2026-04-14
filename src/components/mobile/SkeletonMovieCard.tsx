'use client'

// All skeleton CSS (.skeleton-card, .skeleton-img, .skeleton-line, @keyframes shimmerSweep)
// lives in globals.css — avoids 32 duplicate <style> injections when rows are full.
export default function SkeletonMovieCard() {
    return (
        <div className="skeleton-card">
            <div className="skeleton-img" />
            <div className="skeleton-text">
                <div className="skeleton-line" style={{ height: '11px', width: '75%' }} />
                <div className="skeleton-line" style={{ height: '9px', width: '45%' }} />
            </div>
        </div>
    )
}
