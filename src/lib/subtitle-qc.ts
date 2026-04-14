/**
 * Subtitle Quality Control — Netflix/industry-standard checks.
 * Pure function, zero dependencies. Runs server-side after transcription.
 *
 * Rules enforced:
 *  - CPS (characters per second) ≤ 20 for adult content
 *  - Max 42 characters per line
 *  - Max 2 lines per cue
 *  - Minimum display duration ≥ 833ms (1/1.2 sec)
 *  - Flags low-confidence segments (if confidence score provided)
 */

export type QCIssueType =
    | 'cps-exceeded'       // reading speed too fast
    | 'line-too-long'      // more than 42 chars on one line
    | 'too-many-lines'     // more than 2 lines
    | 'duration-too-short' // cue displayed for < 833ms
    | 'low-confidence'     // Whisper avg_logprob below threshold
    | 'empty-text'         // blank or whitespace-only segment

export interface QCIssue {
    type: QCIssueType
    detail: string
}

export interface QCResult {
    segmentIndex: number
    start: number
    end: number
    text: string
    issues: QCIssue[]
}

export interface QCSummary {
    totalSegments: number
    flaggedSegments: number
    issuesByType: Record<QCIssueType, number>
    results: QCResult[] // only segments with issues
}

const MAX_CPS = 20           // characters per second (Netflix adult standard)
const MAX_CHARS_PER_LINE = 42
const MAX_LINES = 2
const MIN_DURATION_MS = 833  // ~1/1.2 second minimum display

export interface TranscriptSegmentWithConf {
    start: number
    end: number
    text: string
    avg_logprob?: number // Whisper confidence score (negative; closer to 0 = more confident)
}

/**
 * Run Netflix-spec QC on a set of subtitle segments.
 * Returns a summary with only flagged segments for efficiency.
 */
export function runQC(segments: TranscriptSegmentWithConf[]): QCSummary {
    const issuesByType: Record<QCIssueType, number> = {
        'cps-exceeded': 0,
        'line-too-long': 0,
        'too-many-lines': 0,
        'duration-too-short': 0,
        'low-confidence': 0,
        'empty-text': 0,
    }

    const results: QCResult[] = []

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        const issues: QCIssue[] = []
        const durationMs = (seg.end - seg.start) * 1000
        const text = seg.text?.trim() ?? ''

        // Empty text
        if (!text) {
            issues.push({ type: 'empty-text', detail: 'Segment has no text' })
            issuesByType['empty-text']++
        } else {
            const lines = text.split('\n')

            // Too many lines
            if (lines.length > MAX_LINES) {
                issues.push({
                    type: 'too-many-lines',
                    detail: `${lines.length} lines (max ${MAX_LINES})`,
                })
                issuesByType['too-many-lines']++
            }

            // Line length
            for (const line of lines) {
                if (line.length > MAX_CHARS_PER_LINE) {
                    issues.push({
                        type: 'line-too-long',
                        detail: `"${line.slice(0, 20)}…" is ${line.length} chars (max ${MAX_CHARS_PER_LINE})`,
                    })
                    issuesByType['line-too-long']++
                    break // report once per segment
                }
            }

            // CPS check (uses full text char count / display seconds)
            if (durationMs > 0) {
                const charCount = text.replace(/\s+/g, '').length // exclude whitespace
                const cps = charCount / (durationMs / 1000)
                if (cps > MAX_CPS) {
                    issues.push({
                        type: 'cps-exceeded',
                        detail: `${cps.toFixed(1)} CPS (max ${MAX_CPS})`,
                    })
                    issuesByType['cps-exceeded']++
                }
            }
        }

        // Duration check
        if (durationMs < MIN_DURATION_MS && durationMs > 0) {
            issues.push({
                type: 'duration-too-short',
                detail: `${Math.round(durationMs)}ms (min ${MIN_DURATION_MS}ms)`,
            })
            issuesByType['duration-too-short']++
        }

        // Whisper confidence (avg_logprob: 0 = perfect, -1 = uncertain, < -1 = likely hallucination)
        if (seg.avg_logprob !== undefined && seg.avg_logprob < -0.8) {
            issues.push({
                type: 'low-confidence',
                detail: `Whisper confidence: ${seg.avg_logprob.toFixed(2)} (threshold: -0.8)`,
            })
            issuesByType['low-confidence']++
        }

        if (issues.length > 0) {
            results.push({ segmentIndex: i, start: seg.start, end: seg.end, text: seg.text, issues })
        }
    }

    return {
        totalSegments: segments.length,
        flaggedSegments: results.length,
        issuesByType,
        results,
    }
}

/**
 * Format a QC summary for display in the admin UI.
 */
export function formatQCSummary(summary: QCSummary): string {
    if (summary.flaggedSegments === 0) return '✅ No QC issues'
    const parts: string[] = []
    if (summary.issuesByType['cps-exceeded']) parts.push(`${summary.issuesByType['cps-exceeded']} speed`)
    if (summary.issuesByType['line-too-long']) parts.push(`${summary.issuesByType['line-too-long']} line length`)
    if (summary.issuesByType['low-confidence']) parts.push(`${summary.issuesByType['low-confidence']} low confidence`)
    if (summary.issuesByType['too-many-lines']) parts.push(`${summary.issuesByType['too-many-lines']} too many lines`)
    if (summary.issuesByType['duration-too-short']) parts.push(`${summary.issuesByType['duration-too-short']} short cues`)
    if (summary.issuesByType['empty-text']) parts.push(`${summary.issuesByType['empty-text']} empty`)
    return `⚠️ ${summary.flaggedSegments}/${summary.totalSegments} flagged — ${parts.join(', ')}`
}
