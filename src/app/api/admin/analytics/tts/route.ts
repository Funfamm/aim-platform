import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'

/**
 * POST /api/admin/analytics/tts
 * Text-to-speech: ElevenLabs SDK → OpenAI TTS → browser fallback
 */
export async function POST(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { text, voiceId: requestedVoiceId } = await req.json()
    if (!text?.trim()) return NextResponse.json({ error: 'No text provided' }, { status: 400 })

    const cleanText = String(text).slice(0, 5000)

    // ─── 1. ElevenLabs (via official SDK) ───
    const elKey = await prisma.apiKey.findFirst({
        where: { isActive: true, provider: 'elevenlabs' },
        orderBy: { lastUsed: 'asc' },
    })

    const elevenApiKey = elKey?.key || process.env.ELEVENLABS_API_KEY

    if (elevenApiKey) {
        try {
            const client = new ElevenLabsClient({ apiKey: elevenApiKey })

            // Use the caller-supplied voiceId if provided; otherwise auto-pick from account
            let voiceId = requestedVoiceId as string | undefined
            let voiceName = voiceId ?? ''

            if (!voiceId) {
                const voicesResponse = await client.voices.getAll()
                const voices = voicesResponse.voices ?? []
                const preferred = voices.find(v =>
                    ['rachel', 'aria', 'laura', 'sarah', 'charlotte', 'jessica'].includes(
                        (v.name ?? '').toLowerCase()
                    )
                ) ?? voices[0]
                voiceId = preferred?.voiceId ?? 'JBFqnCBsd6RMkjVDRZzb'
                voiceName = preferred?.name ?? voiceId
            }

            const audioStream = await client.textToSpeech.convert(voiceId, {
                text: cleanText,
                modelId: 'eleven_multilingual_v2',
                outputFormat: 'mp3_44100_128',
            })

            // Collect stream — works with both AsyncIterable and ReadableStream
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const combined = await streamToBuffer(audioStream as any)
            if (combined.length === 0) throw new Error('Empty audio stream')

            if (elKey) {
                await prisma.apiKey.update({
                    where: { id: elKey.id },
                    data: { usageCount: { increment: 1 }, lastUsed: new Date(), lastError: null },
                }).catch(() => {})
            }

            return new NextResponse(new Uint8Array(combined), {
                status: 200,
                headers: {
                    'Content-Type': 'audio/mpeg',
                    'Content-Length': combined.length.toString(),
                    'X-TTS-Provider': 'elevenlabs',
                    'X-TTS-Voice': voiceName,
                    'Cache-Control': 'no-cache',
                },
            })

        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)
            console.error('[TTS] ElevenLabs error:', errMsg)
            if (elKey) {
                await prisma.apiKey.update({
                    where: { id: elKey.id },
                    data: { lastError: `EL: ${errMsg.slice(0, 140)}`, lastUsed: new Date() },
                }).catch(() => {})
            }
        }
    }

    // ─── 2. OpenAI TTS ───
    const oaiKey = await prisma.apiKey.findFirst({
        where: { isActive: true, provider: 'openai' },
        orderBy: { lastUsed: 'asc' },
    })
    const openAIKey = oaiKey?.key || process.env.OPENAI_API_KEY

    if (openAIKey) {
        try {
            const res = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${openAIKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'tts-1', input: cleanText.slice(0, 4096), voice: 'nova', response_format: 'mp3' }),
            })
            if (res.ok) {
                const audio = await res.arrayBuffer()
                if (oaiKey) {
                    await prisma.apiKey.update({
                        where: { id: oaiKey.id },
                        data: { usageCount: { increment: 1 }, lastUsed: new Date(), lastError: null },
                    }).catch(() => {})
                }
                return new NextResponse(audio, {
                    status: 200,
                    headers: {
                        'Content-Type': 'audio/mpeg',
                        'Content-Length': audio.byteLength.toString(),
                        'X-TTS-Provider': 'openai',
                        'Cache-Control': 'no-cache',
                    },
                })
            }
            console.error('[TTS] OpenAI error:', res.status)
        } catch (err) {
            console.error('[TTS] OpenAI network error:', err)
        }
    }

    // ─── 3. Browser fallback ───
    return NextResponse.json({
        fallback: true,
        reason: elevenApiKey
            ? 'ElevenLabs call failed — check the error in Settings → API Keys'
            : 'No ElevenLabs or OpenAI key configured',
    })
}

// ─── Helper: collect AsyncIterable or ReadableStream into a Buffer ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: Buffer[] = []
    if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }
    } else if (stream instanceof ReadableStream) {
        const reader = stream.getReader()
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(Buffer.isBuffer(value) ? value : Buffer.from(value))
        }
    }
    return Buffer.concat(chunks)
}
