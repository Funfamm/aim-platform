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

    const userCdn = process.env.NEXT_PUBLIC_CDN_URL
    const defaults = [
        'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
        'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd'
    ]
    const cdnsToTry = userCdn ? [`${userCdn}/ffmpeg/0.12.6`, ...defaults] : defaults

    let lastError: unknown
    for (const cdnBase of cdnsToTry) {
        try {
            await ffmpeg.load({
                coreURL: await toBlobURL(`${cdnBase}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${cdnBase}/ffmpeg-core.wasm`, 'application/wasm'),
            })
            ffmpegInstance = ffmpeg
            return ffmpeg
        } catch (e) {
            console.warn(`[getFFmpeg] Failed to load from ${cdnBase}:`, e)
            lastError = e
        }
    }

    throw new Error(
        userCdn 
            ? `Custom CDN (${userCdn}) failed. If this is an R2 bucket, ensure you have added a CORS policy allowing GET requests from your domain.`
            : `All CDNs (unpkg, jsdelivr) failed to load FFmpeg. Your network, adblocker, or firewall is blocking the download.`
    )
}

/**
 * Load and cache the Whisper ASR pipeline.
 * Uses whisper-medium — 33% lower WER than whisper-small, still feasible in browser.
 * Supports 99 languages, auto-detects language per chunk.
 * First download is ~464MB, cached after that.
 */
async function getTranscriber() {
    if (transcriberPipeline) return transcriberPipeline

    const { pipeline } = await import('@huggingface/transformers')
    // Choose model via env var, default to medium for best accuracy
    const modelName = process.env.NEXT_PUBLIC_WHISPER_MODEL || 'Xenova/whisper-medium'
    try {
        transcriberPipeline = await pipeline(
            'automatic-speech-recognition',
            modelName,
        )
        console.info(`[transcribe-client] Loaded Whisper model ${modelName}`)
    } catch (e) {
        console.warn(`[transcribe-client] Failed to load ${modelName}:`, e)
        // Fallback to a smaller model that is more likely to fit in memory
        const fallback = 'Xenova/whisper-base'
        console.info(`[transcribe-client] Falling back to ${fallback}`)
        transcriberPipeline = await pipeline(
            'automatic-speech-recognition',
            fallback,
        )
    }
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
        let ffmpeg: FFmpeg
        try {
            ffmpeg = await getFFmpeg()
        } catch (e) {
            throw new Error(`FFmpeg load failed (CDN blocked or offline): ${e instanceof Error ? e.message : String(e)}`)
        }

        // 2. Write video to FFmpeg virtual filesystem
        report('extracting-audio', 'Extracting audio from video...')
        let fileData: Uint8Array
        if (typeof videoSource === 'string') {
            // Try direct fetch first; if CORS blocks it, proxy through our server
            try {
                fileData = await fetchFile(videoSource)
            } catch {
                report('extracting-audio', 'Direct fetch blocked — requesting server proxy...')
                const proxyUrl = `/api/admin/subtitles/proxy-video?url=${encodeURIComponent(videoSource)}`
                // New proxy returns { signedUrl } for R2 files — fetch that URL directly.
                // For non-R2 it streams binary, so handle both response shapes.
                let proxyRes: Response
                try {
                    proxyRes = await fetch(proxyUrl)
                } catch (e) {
                    throw new Error(`Server proxy request failed (Next.js route crashed or network offline): ${e instanceof Error ? e.message : String(e)}`)
                }
                if (!proxyRes.ok) throw new Error(`Proxy failed: ${proxyRes.status}`)
                const contentType = proxyRes.headers.get('content-type') || ''
                if (contentType.includes('application/json')) {
                    const { signedUrl } = await proxyRes.json()
                    if (!signedUrl) throw new Error('Proxy returned no signed URL')
                    report('extracting-audio', 'Fetching via secure signed URL...')
                    try {
                        fileData = await fetchFile(signedUrl)
                    } catch (signedUrlErr) {
                        console.error('[transcribeVideo] Signed URL fetch failed:', signedUrlErr)
                        throw new Error('Failed to fetch from R2 (CORS error). Please add a CORS policy to your Cloudflare R2 bucket allowing GET requests from your domain.')
                    }
                } else {
                    // Streaming binary fallback (non-R2 CDN)
                    try {
                        const blob = await proxyRes.blob()
                        fileData = new Uint8Array(await blob.arrayBuffer())
                    } catch (e) {
                        throw new Error(`Server binary stream interrupted (Vercel maxDuration hit?): ${e instanceof Error ? e.message : String(e)}`)
                    }
                }
            }
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
        report('loading-model', 'Loading AI speech model (~464MB first time)...')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let transcriber: any
        try {
            transcriber = await getTranscriber()
        } catch (e) {
            throw new Error(`AI Model load failed (HuggingFace blocked or out of memory): ${e instanceof Error ? e.message : String(e)}`)
        }

        // 6. Transcribe — Whisper auto-detects language and translates to English
        report('transcribing', 'Transcribing audio (auto-detects all languages)...')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let result: any
        try {
            result = await transcriber(audioUrl, {
                chunk_length_s: 30,
                stride_length_s: 5,
                return_timestamps: true,
                task: 'translate',  // auto-translate ANY language to English
            })
        } catch (e) {
            throw new Error(`AI processing failed (Device too slow or audio invalid): ${e instanceof Error ? e.message : String(e)}`)
        }

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
        console.error('[transcribeVideo] Fatal error:', err)
        let errorMsg = err instanceof Error ? err.message : 'Transcription failed'
        
        // Add more context if it's a generic "Failed to fetch"
        if (errorMsg === 'Failed to fetch') {
            errorMsg = 'Failed to fetch (Check console. Usually a CORS issue or network block)'
        }

        report('error', errorMsg)
        throw new Error(errorMsg) // Throw the enhanced error so the UI displays it
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
