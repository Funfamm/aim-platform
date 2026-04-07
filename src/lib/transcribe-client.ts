'use client'

/**
 * Client-side video transcription using FFmpeg WASM + Transformers.js Whisper.
 * Runs entirely in the browser — zero API cost.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

// ── Types ──
export interface TranscriptSegment {
    start: number
    end: number
    text: string
}

export type TranscriptionStatus =
    | 'idle'
    | 'loading-ffmpeg'
    | 'extracting-audio'
    | 'loading-model'
    | 'transcribing'
    | 'done'
    | 'error'

export interface TranscriptionResult {
    segments: TranscriptSegment[]
    fullText: string
}

// ── Singleton caches ──
let ffmpegInstance: FFmpeg | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriberPipeline: any = null

/**
 * Load and cache FFmpeg WASM instance.
 */
async function getFFmpeg(): Promise<FFmpeg> {
    if (ffmpegInstance) return ffmpegInstance

    const ffmpeg = new FFmpeg()

    // Load WASM from CDN
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
    await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    ffmpegInstance = ffmpeg
    return ffmpeg
}

/**
 * Load and cache the Whisper ASR pipeline.
 * Uses whisper-small (multilingual) — supports 99 languages and auto-detects
 * language per chunk, so it handles code-switching (mixing languages in one video).
 * First download is ~244MB, cached after that.
 */
async function getTranscriber() {
    if (transcriberPipeline) return transcriberPipeline

    const { pipeline } = await import('@huggingface/transformers')
    transcriberPipeline = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-small',
    )
    return transcriberPipeline
}

/**
 * Transcribe a video file entirely in the browser.
 * Uses Whisper's 'translate' task which auto-translates any spoken language
 * to English — handles multilingual films perfectly.
 *
 * @param videoSource   - The File object or URL string
 * @param onStatus      - Callback for status updates
 * @returns              English transcript segments with timestamps + full text
 */
export async function transcribeVideo(
    videoSource: File | string,
    onStatus?: (status: TranscriptionStatus, detail?: string) => void,
): Promise<TranscriptionResult> {
    const report = (s: TranscriptionStatus, d?: string) => onStatus?.(s, d)

    try {
        // 1. Load FFmpeg
        report('loading-ffmpeg', 'Loading video engine...')
        const ffmpeg = await getFFmpeg()

        // 2. Write video to FFmpeg virtual filesystem
        report('extracting-audio', 'Extracting audio from video...')
        let fileData: Uint8Array
        if (typeof videoSource === 'string') {
            // It's a URL — fetch it
            fileData = await fetchFile(videoSource)
        } else {
            fileData = await fetchFile(videoSource)
        }
        await ffmpeg.writeFile('input-video', fileData)

        // 3. Extract audio as mono 16kHz WAV (Whisper requirement)
        await ffmpeg.exec([
            '-i', 'input-video',
            '-vn',                   // no video
            '-acodec', 'pcm_s16le',  // 16-bit PCM
            '-ar', '16000',          // 16 kHz sample rate
            '-ac', '1',              // mono
            'audio.wav',
        ])

        // 4. Read the WAV output
        const wavData = await ffmpeg.readFile('audio.wav')
        const wavBytes = wavData instanceof Uint8Array ? new Uint8Array(wavData) : wavData
        const wavBlob = new Blob([wavBytes as BlobPart], { type: 'audio/wav' })
        const audioUrl = URL.createObjectURL(wavBlob)

        // 5. Load Whisper model
        report('loading-model', 'Loading AI speech model (~244MB first time)...')
        const transcriber = await getTranscriber()

        // 6. Transcribe — Whisper auto-detects language and translates to English
        report('transcribing', 'Transcribing audio (auto-detects all languages)...')
        const result = await transcriber(audioUrl, {
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: true,
            task: 'translate',  // auto-translate ANY language to English
        })

        // Cleanup
        URL.revokeObjectURL(audioUrl)
        await ffmpeg.deleteFile('input-video').catch(() => {})
        await ffmpeg.deleteFile('audio.wav').catch(() => {})

        // 7. Parse result
        const output = Array.isArray(result) ? result[0] : result
        const segments: TranscriptSegment[] = Array.isArray(output.chunks)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? output.chunks.map((chunk: any) => ({
                start: chunk.timestamp?.[0] || 0,
                end: chunk.timestamp?.[1] || 0,
                text: (chunk.text || '').trim(),
            }))
            : [{ start: 0, end: 0, text: (output.text || '').trim() }]

        const fullText = segments.map(s => s.text).join(' ')

        report('done', 'Transcription complete!')
        return { segments, fullText }
    } catch (err) {
        report('error', err instanceof Error ? err.message : 'Transcription failed')
        throw err
    }
}

/**
 * Convert transcript segments to SRT subtitle format.
 */
export function segmentsToSRT(segments: TranscriptSegment[]): string {
    return segments
        .map((seg, i) => {
            const startSrt = formatSrtTime(seg.start)
            const endSrt = formatSrtTime(seg.end)
            return `${i + 1}\n${startSrt} --> ${endSrt}\n${seg.text}\n`
        })
        .join('\n')
}

function formatSrtTime(seconds: number): string {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.round((seconds % 1) * 1000)
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad3(ms)}`
}

function pad(n: number): string {
    return n.toString().padStart(2, '0')
}

function pad3(n: number): string {
    return n.toString().padStart(3, '0')
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}
