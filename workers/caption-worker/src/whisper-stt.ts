import OpenAI, { toFile } from 'openai'
import { config } from './config'
import { encodePcmToWav } from './audio-buffer'
import type { AudioChunk, CaptionSegment } from './types'

const openai = new OpenAI({ apiKey: config.openai.apiKey })

/**
 * Sends an audio chunk to OpenAI Whisper and returns a caption segment.
 * Returns null if the transcription is empty (silence / below confidence threshold).
 *
 * Uses toFile() from the OpenAI SDK — the correct way to pass binary data in Node.js.
 * Never use `new Blob()` or `new File()` — those are browser-only Web APIs.
 */
export async function transcribeChunk(chunk: AudioChunk): Promise<CaptionSegment | null> {
    const wavBuffer = encodePcmToWav(chunk.samples, chunk.sampleRate, 1)

    // toFile() wraps a Buffer into the File-like object the SDK expects in Node.js.
    // Passing the MIME type ensures the API recognises the WAV format.
    const file = await toFile(wavBuffer, 'audio.wav', { type: 'audio/wav' })

    try {
        const response = await openai.audio.transcriptions.create({
            file,
            model: config.openai.model as 'whisper-1',
            response_format: 'verbose_json', // gives us language detection
            ...(config.openai.language ? { language: config.openai.language } : {}),
        })

        const text = response.text?.trim()
        if (!text || text.length < 2) return null

        return {
            timestamp: Date.now(),
            speakerIdentity: chunk.participantIdentity,
            speakerName: chunk.participantName,
            sourceLang: (response as { language?: string }).language ?? 'unknown',
            originalText: text,
        }
    } catch (err) {
        console.error('[whisper-stt] transcription error', {
            participant: chunk.participantIdentity,
            error: err instanceof Error ? err.message : String(err),
        })
        return null
    }
}
