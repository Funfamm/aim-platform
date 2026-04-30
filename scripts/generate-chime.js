/**
 * Generate a soft notification chime as a WAV file.
 * Run: node scripts/generate-chime.js
 * Output: public/sounds/message.mp3 (actually a WAV — browsers play it fine via <audio>)
 */
const fs = require('fs')
const path = require('path')

const SAMPLE_RATE = 44100
const DURATION = 0.35 // seconds — short and subtle
const CHANNELS = 1
const BITS_PER_SAMPLE = 16

const totalSamples = Math.floor(SAMPLE_RATE * DURATION)
const dataSize = totalSamples * CHANNELS * (BITS_PER_SAMPLE / 8)

// WAV header
const header = Buffer.alloc(44)
header.write('RIFF', 0)
header.writeUInt32LE(36 + dataSize, 4)
header.write('WAVE', 8)
header.write('fmt ', 12)
header.writeUInt32LE(16, 16) // subchunk1 size
header.writeUInt16LE(1, 20) // PCM
header.writeUInt16LE(CHANNELS, 22)
header.writeUInt32LE(SAMPLE_RATE, 24)
header.writeUInt32LE(SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8), 28)
header.writeUInt16LE(CHANNELS * (BITS_PER_SAMPLE / 8), 32)
header.writeUInt16LE(BITS_PER_SAMPLE, 34)
header.write('data', 36)
header.writeUInt32LE(dataSize, 40)

// Generate a soft two-tone chime (C6 + E6, short decay)
const data = Buffer.alloc(dataSize)
for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE
    // Two harmonious tones
    const freq1 = 1047 // C6
    const freq2 = 1319 // E6
    // Exponential decay envelope
    const envelope = Math.exp(-t * 12) * 0.6
    // Mix tones
    const sample = (
        Math.sin(2 * Math.PI * freq1 * t) * 0.5 +
        Math.sin(2 * Math.PI * freq2 * t) * 0.3 +
        Math.sin(2 * Math.PI * freq1 * 2 * t) * 0.1 // soft overtone
    ) * envelope
    // Clamp and write
    const val = Math.max(-1, Math.min(1, sample))
    const int16 = Math.floor(val * 32767)
    data.writeInt16LE(int16, i * 2)
}

const out = path.join(__dirname, '..', 'public', 'sounds', 'message.mp3')
fs.writeFileSync(out, Buffer.concat([header, data]))
console.log(`✅ Generated chime: ${out} (${(44 + dataSize)} bytes, ${DURATION}s)`)
