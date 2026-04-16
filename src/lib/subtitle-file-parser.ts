/**
 * src/lib/subtitle-file-parser.ts — Client-side subtitle file utilities (SRP fix).
 *
 * Previously parseSRT, parseVTT, parseSubtitleFile, and handleSrtUpload were
 * defined directly inside page.tsx — a 1700-line client component. These functions
 * have zero React dependency and belong in a dedicated utility module.
 *
 * SRP: this module owns exactly two concerns:
 *   1. Parsing SRT / VTT files into subtitle segments (pure functions)
 *   2. Orchestrating the upload workflow (API call + callback hooks)
 *
 * The React component's only job is to wire its state setters to the callbacks.
 */

export type SubtitleSegment = { start: number; end: number; text: string }

// ── Parsers ────────────────────────────────────────────────────────────────────

/**
 * Parse an SRT file string into subtitle segments.
 * Strips HTML tags and handles Windows/Unix line endings.
 */
export function parseSRT(text: string): SubtitleSegment[] {
    const parseTime = (s: string) => {
        const [h, m, sc] = s.trim().replace(',', '.').split(':')
        return parseInt(h) * 3600 + parseInt(m) * 60 + parseFloat(sc)
    }
    return text.trim().split(/\n\n+/).flatMap(block => {
        const lines = block.trim().split('\n')
        const timeLine = lines.find(l => l.includes('-->'))
        if (!timeLine) return []
        const [startStr, endStr] = timeLine.split('-->')
        const textLines = lines
            .filter(l => !l.includes('-->') && !/^\d+$/.test(l.trim()) && l.trim())
            .map(l => l.replace(/<[^>]+>/g, '').trim())
        if (textLines.length === 0) return []
        return [{ start: parseTime(startStr), end: parseTime(endStr), text: textLines.join(' ') }]
    })
}

/**
 * Parse a WebVTT file string into subtitle segments.
 * Strips cue settings annotations and HTML tags.
 */
export function parseVTT(text: string): SubtitleSegment[] {
    const parseTime = (s: string) => {
        const clean = s.trim().split(' ')[0]
        const parts = clean.split(':')
        if (parts.length === 2) return parseInt(parts[0]) * 60 + parseFloat(parts[1].replace(',', '.'))
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2].replace(',', '.'))
    }
    const lines = text.split('\n')
    const segments: SubtitleSegment[] = []
    let i = 0
    while (i < lines.length) {
        const line = lines[i].trim()
        if (line.includes('-->')) {
            const [startStr, endStr] = line.split('-->')
            i++
            const textLines: string[] = []
            while (i < lines.length && lines[i].trim() !== '') {
                const t = lines[i].replace(/<[^>]+>/g, '').trim()
                if (t) textLines.push(t)
                i++
            }
            if (textLines.length > 0) {
                segments.push({ start: parseTime(startStr), end: parseTime(endStr), text: textLines.join(' ') })
            }
        } else { i++ }
    }
    return segments
}

/**
 * Auto-detect format from filename or file content and parse accordingly.
 * Supports .srt and .vtt.
 */
export function parseSubtitleFile(filename: string, content: string): SubtitleSegment[] {
    return (filename.endsWith('.vtt') || content.trimStart().startsWith('WEBVTT'))
        ? parseVTT(content)
        : parseSRT(content)
}

// ── Upload workflow ────────────────────────────────────────────────────────────

/**
 * Callbacks the UI component provides for upload progress reporting.
 * The component wires these to its own state setters — this module
 * never imports React or touches component state directly.
 */
export type SubtitleUploadHandlers = {
    /** Called when a new phase starts: transcribing (started), done (success), error (failure). */
    onPhase: (phase: 'transcribing' | 'done' | 'error') => void
    /** Status message to display in the UI. */
    onStatus: (msg: string) => void
    /** 0–100 progress percentage. */
    onProgress: (pct: number) => void
    /**
     * Called on success with the segment count.
     * The component should set translationCount to 1 (English only) and
     * translateStatus to 'pending' when this fires.
     */
    onCountReady: (segmentCount: number) => void
    /** Called with an error message string on failure. */
    onError: (msg: string) => void
}

/**
 * Parse an uploaded SRT/VTT file and POST the segments to /api/admin/subtitles.
 * Reports progress and outcome via the provided callbacks.
 * The admin can then use the CC button to run translation on the saved English track.
 */
export async function uploadSubtitleFile(
    projectId: string,
    file: File,
    handlers: SubtitleUploadHandlers,
): Promise<void> {
    const { onPhase, onStatus, onProgress, onCountReady, onError } = handlers

    try {
        const content = await file.text()
        const segments = parseSubtitleFile(file.name, content)

        if (segments.length === 0) {
            onError('No valid subtitle segments found in this file. Make sure it is a valid .srt or .vtt file.')
            return
        }

        onPhase('transcribing')
        onStatus(`💾 Saving ${segments.length} segments…`)
        onProgress(20)

        const res = await fetch('/api/admin/subtitles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId,
                language: 'en',
                segments,
                transcribedWith: 'manual-upload',
                status: 'pending',
            }),
        })

        if (!res.ok) {
            const data = await res.json().catch(() => ({}))
            throw new Error((data as { error?: string }).error || 'Failed to save transcript')
        }

        onProgress(100)
        onStatus(`✓ ${segments.length} segments loaded — click CC to translate`)
        onPhase('done')
        onCountReady(segments.length)

    } catch (err) {
        onStatus('❌ Upload failed')
        onPhase('error')
        onError(err instanceof Error ? err.message : 'SRT upload failed')
    }
}
