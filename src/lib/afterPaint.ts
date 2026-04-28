/** Runs callback after the browser's next paint cycle (2× rAF). */
export function afterPaint(fn: () => void): void {
    requestAnimationFrame(() => requestAnimationFrame(fn))
}
