import { config } from './config'
import type { AudioChunk } from './types'

/**
 * Accumulates PCM audio frames from a single participant.
 * When enough audio has been collected (chunkDurationSec), emits a complete chunk
 * for Whisper processing and resets the internal buffer.
 */
export class AudioBuffer {
    private readonly participantIdentity: string
    private readonly participantName: string
    private readonly targetSamples: number
    private frames: Int16Array[] = []
    private totalSamples = 0
    private readonly onChunkReady: (chunk: AudioChunk) => void

    constructor(
        participantIdentity: string,
        participantName: string,
        onChunkReady: (chunk: AudioChunk) => void,
    ) {
        this.participantIdentity = participantIdentity
        this.participantName = participantName
        this.onChunkReady = onChunkReady
        // Samples needed for one chunk at 16 kHz
        this.targetSamples = config.audio.sampleRate * config.audio.chunkDurationSec
    }

    /** Push a PCM frame into the buffer. Emits when thresholds are met. */
    push(frame: Int16Array): void {
        this.frames.push(frame)
        this.totalSamples += frame.length

        if (this.totalSamples >= this.targetSamples) {
            this.flush()
        }
    }

    /** Force-emit whatever is buffered (called on participant disconnect). */
    flush(): void {
        if (this.totalSamples === 0) return

        // Merge all frames into a single contiguous Int16Array
        const merged = new Int16Array(this.totalSamples)
        let offset = 0
        for (const frame of this.frames) {
            merged.set(frame, offset)
            offset += frame.length
        }

        this.frames = []
        this.totalSamples = 0

        this.onChunkReady({
            participantIdentity: this.participantIdentity,
            participantName: this.participantName,
            samples: merged,
            sampleRate: config.audio.sampleRate,
        })
    }
}

/**
 * Encodes raw PCM samples (Int16, mono) to a WAV-format Buffer
 * so it can be passed directly to the OpenAI Files API.
 */
export function encodePcmToWav(samples: Int16Array, sampleRate: number, numChannels = 1): Buffer {
    const bitsPerSample = 16
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
    const blockAlign = numChannels * (bitsPerSample / 8)
    const dataSize = samples.byteLength
    const buffer = Buffer.alloc(44 + dataSize)

    // RIFF header
    buffer.write('RIFF', 0)
    buffer.writeUInt32LE(36 + dataSize, 4)
    buffer.write('WAVE', 8)

    // fmt chunk
    buffer.write('fmt ', 12)
    buffer.writeUInt32LE(16, 16)             // chunk size
    buffer.writeUInt16LE(1, 20)              // PCM format
    buffer.writeUInt16LE(numChannels, 22)
    buffer.writeUInt32LE(sampleRate, 24)
    buffer.writeUInt32LE(byteRate, 28)
    buffer.writeUInt16LE(blockAlign, 32)
    buffer.writeUInt16LE(bitsPerSample, 34)

    // data chunk
    buffer.write('data', 36)
    buffer.writeUInt32LE(dataSize, 40)

    // PCM data chunk — Int16 samples are already little-endian, matching WAV format.
    // Copy the underlying ArrayBuffer directly (single memcopy, O(1) overhead).
    const pcmBytes = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
    pcmBytes.copy(buffer, 44)

    return buffer
}
