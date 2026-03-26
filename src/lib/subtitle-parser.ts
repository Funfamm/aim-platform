'use client'

/**
 * Parse SRT (SubRip) and VTT (WebVTT) subtitle files into transcript segments.
 */

import type { TranscriptSegment } from './transcribe-client'

/**
 * Parse a time string from SRT format (HH:MM:SS,mmm) or VTT format (HH:MM:SS.mmm)
 * into seconds.
 */
function parseTimestamp(ts: string): number {
    ts = ts.trim().replace(',', '.')
    const parts = ts.split(':')
    if (parts.length === 3) {
        const [h, m, s] = parts
        return parseFloat(h) * 3600 + parseFloat(m) * 60 + parseFloat(s)
    }
    if (parts.length === 2) {
        const [m, s] = parts
        return parseFloat(m) * 60 + parseFloat(s)
    }
    return parseFloat(ts)
}

/**
 * Parse an SRT or VTT file content string into TranscriptSegment array.
 */
export function parseSubtitleFile(content: string): TranscriptSegment[] {
    const segments: TranscriptSegment[] = []

    // Normalize line endings
    const text = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    // Remove VTT header if present
    const lines = text.replace(/^WEBVTT[\s\S]*?\n\n/, '').split('\n')

    let i = 0
    while (i < lines.length) {
        // Skip blank lines and sequence numbers
        while (i < lines.length && (!lines[i].trim() || /^\d+$/.test(lines[i].trim()))) {
            i++
        }
        if (i >= lines.length) break

        // Look for timestamp line (contains -->)
        const line = lines[i]
        if (line.includes('-->')) {
            const [startStr, endStr] = line.split('-->')
            const start = parseTimestamp(startStr)
            const end = parseTimestamp(endStr)

            i++
            // Collect text lines until blank line
            const textLines: string[] = []
            while (i < lines.length && lines[i].trim()) {
                // Strip HTML tags from VTT
                textLines.push(lines[i].replace(/<[^>]+>/g, '').trim())
                i++
            }
            const segText = textLines.join(' ').trim()
            if (segText) {
                segments.push({ start, end, text: segText })
            }
        } else {
            i++
        }
    }

    return segments
}
