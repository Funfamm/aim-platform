/**
 * src/lib/sse-reader.ts — Shared SSE stream reader (DRY fix — Gap X-3).
 *
 * Both handleGenerateSubtitles (bulk translate) and retryLang (single retry)
 * previously contained identical buffer/decode/split/JSON.parse logic.
 * This module centralises that into a single reusable function.
 *
 * Zero external dependencies — works with any ReadableStream<Uint8Array>.
 */

/**
 * Read an SSE stream from a fetch Response.body, parsing each `data: {...}`
 * event and calling `onEvent` for every successfully parsed JSON object.
 *
 * Handles buffering across chunk boundaries and silently skips malformed events.
 *
 * @param reader  - The ReadableStream reader from `response.body.getReader()`
 * @param onEvent - Called once per parsed SSE data object
 */
export async function readSSEStream<T = Record<string, unknown>>(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onEvent: (data: T) => void | Promise<void>,
): Promise<void> {
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''
        for (const event of events) {
            const line = event.replace(/^data: /, '').trim()
            if (!line) continue
            try {
                const data = JSON.parse(line) as T
                await onEvent(data)
            } catch { /* malformed SSE event — skip */ }
        }
    }
}
