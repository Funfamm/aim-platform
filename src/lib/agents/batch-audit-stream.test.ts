/**
 * Tests for NDJSON stream parsing and state management
 *
 * Mirrors the chunk-parsing logic from the admin applications page's
 * handleBulkAction batch-audit handler. Extracted as a pure function
 * for testability.
 */
import { describe, it, expect } from 'vitest'

// ── Types ──
interface BatchResult {
    id: string
    fullName: string
    status: string
    aiScore?: number
    recommendation?: string
    error?: string
}

interface BatchProgress {
    total: number
    done: number
    results: BatchResult[]
}

// ── Extracted parser ──
// Mirrors the NDJSON chunk-parsing logic from page.tsx's handleBulkAction
function parseNDJSONChunk(
    chunk: string,
    currentState: BatchProgress
): BatchProgress {
    const state = {
        ...currentState,
        results: [...currentState.results],
    }

    const lines = chunk.split('\n').filter(l => l.trim().length > 0)

    for (const line of lines) {
        try {
            const obj = JSON.parse(line)
            if (obj.type === 'result') {
                state.done += 1
                state.results.push(obj)
            } else if (obj.type === 'eof') {
                state.total = obj.summary?.total ?? state.total
                state.done = obj.summary?.total ?? state.done
            }
        } catch {
            // Malformed line — skip silently (matches production behavior)
        }
    }

    return state
}

// ═══════════════════════════════════════════════════════════════
// parseNDJSONChunk
// ═══════════════════════════════════════════════════════════════
describe('NDJSON Stream Parser', () => {
    const emptyState: BatchProgress = { total: 5, done: 0, results: [] }

    it('should parse a single result line', () => {
        const chunk = JSON.stringify({
            type: 'result', id: 'a1', fullName: 'John Doe',
            status: 'success', aiScore: 85, recommendation: 'GOOD_FIT',
        }) + '\n'

        const result = parseNDJSONChunk(chunk, emptyState)
        expect(result.done).toBe(1)
        expect(result.results).toHaveLength(1)
        expect(result.results[0].fullName).toBe('John Doe')
        expect(result.results[0].aiScore).toBe(85)
    })

    it('should parse multiple result lines in one chunk', () => {
        const lines = [
            JSON.stringify({ type: 'result', id: 'a1', fullName: 'Alice', status: 'success', aiScore: 90 }),
            JSON.stringify({ type: 'result', id: 'a2', fullName: 'Bob', status: 'skipped', aiScore: 70 }),
            JSON.stringify({ type: 'result', id: 'a3', fullName: 'Carol', status: 'error', error: 'API failed' }),
        ].join('\n') + '\n'

        const result = parseNDJSONChunk(lines, emptyState)
        expect(result.done).toBe(3)
        expect(result.results).toHaveLength(3)
        expect(result.results[0].fullName).toBe('Alice')
        expect(result.results[1].status).toBe('skipped')
        expect(result.results[2].error).toBe('API failed')
    })

    it('should handle eof line — set done to total from summary', () => {
        const chunk = JSON.stringify({
            type: 'eof', summary: { total: 5, success: 3, skipped: 1, errors: 1 },
        }) + '\n'

        const stateWithResults: BatchProgress = {
            total: 5, done: 4, results: [
                { id: 'a1', fullName: 'Alice', status: 'success' },
            ],
        }

        const result = parseNDJSONChunk(chunk, stateWithResults)
        expect(result.done).toBe(5) // set to summary.total
        expect(result.results).toHaveLength(1) // results preserved
    })

    it('should gracefully skip malformed JSON lines', () => {
        const chunk = 'not valid json\n' +
            JSON.stringify({ type: 'result', id: 'a1', fullName: 'Alice', status: 'success' }) + '\n' +
            '{broken json\n'

        const result = parseNDJSONChunk(chunk, emptyState)
        expect(result.done).toBe(1) // only the valid line was parsed
        expect(result.results).toHaveLength(1)
        expect(result.results[0].fullName).toBe('Alice')
    })

    it('should handle a mixed chunk: result + result + eof', () => {
        const chunk = [
            JSON.stringify({ type: 'result', id: 'a1', fullName: 'Alice', status: 'success', aiScore: 88 }),
            JSON.stringify({ type: 'result', id: 'a2', fullName: 'Bob', status: 'success', aiScore: 72 }),
            JSON.stringify({ type: 'eof', summary: { total: 2, success: 2, skipped: 0, errors: 0 } }),
        ].join('\n') + '\n'

        const result = parseNDJSONChunk(chunk, { total: 2, done: 0, results: [] })
        expect(result.results).toHaveLength(2)
        expect(result.done).toBe(2) // eof sets this to summary.total
    })

    it('should filter out empty and whitespace-only lines', () => {
        const chunk = '\n   \n' +
            JSON.stringify({ type: 'result', id: 'a1', fullName: 'Alice', status: 'success' }) +
            '\n\n   \n'

        const result = parseNDJSONChunk(chunk, emptyState)
        expect(result.done).toBe(1)
        expect(result.results).toHaveLength(1)
    })

    it('should not mutate the input state', () => {
        const original: BatchProgress = { total: 5, done: 0, results: [] }
        const chunk = JSON.stringify({ type: 'result', id: 'a1', fullName: 'Test', status: 'success' }) + '\n'

        parseNDJSONChunk(chunk, original)
        expect(original.done).toBe(0) // unchanged
        expect(original.results).toHaveLength(0) // unchanged
    })

    it('should accumulate results across multiple parseNDJSONChunk calls', () => {
        const chunk1 = JSON.stringify({ type: 'result', id: 'a1', fullName: 'Alice', status: 'success' }) + '\n'
        const chunk2 = JSON.stringify({ type: 'result', id: 'a2', fullName: 'Bob', status: 'success' }) + '\n'

        const state1 = parseNDJSONChunk(chunk1, emptyState)
        const state2 = parseNDJSONChunk(chunk2, state1)

        expect(state2.done).toBe(2)
        expect(state2.results).toHaveLength(2)
        expect(state2.results[0].fullName).toBe('Alice')
        expect(state2.results[1].fullName).toBe('Bob')
    })

    it('should handle an empty chunk', () => {
        const result = parseNDJSONChunk('', emptyState)
        expect(result.done).toBe(0)
        expect(result.results).toHaveLength(0)
    })
})
