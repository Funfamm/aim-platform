/**
 * Typed environment variable parser for the caption worker.
 * All values are validated at startup — the process exits if any required var is missing.
 */

function required(name: string): string {
    const value = process.env[name]
    if (!value) {
        console.error(`[config] Missing required environment variable: ${name}`)
        process.exit(1)
    }
    return value
}

function optional(name: string, fallback: string): string {
    return process.env[name] ?? fallback
}

export const config = {
    // ── LiveKit (dedicated worker key-pair, NOT the main app key) ──
    livekit: {
        url: required('WORKER_LIVEKIT_URL'),
        apiKey: required('WORKER_LIVEKIT_API_KEY'),
        apiSecret: required('WORKER_LIVEKIT_API_SECRET'),
        /** Display name for the bot participant in LiveKit rooms */
        agentIdentity: optional('WORKER_AGENT_IDENTITY', 'aim-caption-bot'),
        agentName: optional('WORKER_AGENT_NAME', 'AIM Caption Bot'),
    },

    // ── OpenAI Whisper ──
    openai: {
        apiKey: required('OPENAI_API_KEY'),
        /** Whisper model — whisper-1 is the only currently available model */
        model: optional('WHISPER_MODEL', 'whisper-1'),
        /** Language hint for Whisper. Empty = auto-detect */
        language: optional('WHISPER_LANGUAGE', ''),
    },

    // ── Google Gemini (translation) ──
    gemini: {
        apiKey: required('GEMINI_API_KEY'),
        model: optional('GEMINI_MODEL', 'gemini-2.0-flash'),
    },

    // ── Audio processing ──
    audio: {
        /** Accumulate this many seconds of audio before sending to Whisper */
        chunkDurationSec: parseInt(optional('AUDIO_CHUNK_DURATION_SEC', '3')),
        /** Sample rate to request from LiveKit (Whisper expects 16 kHz) */
        sampleRate: 16_000,
        numChannels: 1,
    },

    // ── HTTP server ──
    http: {
        port: parseInt(optional('PORT', '8080')),
        /** Shared secret that the Next.js app sends when forwarding webhooks */
        webhookSecret: required('WORKER_WEBHOOK_SECRET'),
    },

    // ── Feature flags ──
    features: {
        /** Set to false to only publish captions.original without translation */
        enableTranslation: optional('ENABLE_TRANSLATION', 'true') === 'true',
        /** Languages to translate into — comma-separated. Defaults to all 11 */
        translateLangs: optional(
            'TRANSLATE_LANGS',
            'en,ar,de,es,fr,hi,ja,ko,pt,ru,zh',
        ).split(',').filter(Boolean),
    },
} as const
