/**
 * AIM Caption Worker — entry point
 *
 * Starts the HTTP server and registers graceful shutdown handlers.
 * The actual work happens in RoomAgent instances created on-demand
 * when the Next.js app POSTs to /start-session.
 */
import { config } from './config'
import { createHttpServer } from './http-server'
import { stopRoomAgent, getActiveRooms } from './room-agent'

console.info('[index] AIM Caption Worker starting…')
console.info(`[index] LiveKit URL: ${config.livekit.url}`)
console.info(`[index] Whisper model: ${config.openai.model}`)
console.info(`[index] Gemini model: ${config.gemini.model}`)
console.info(`[index] Translation: ${config.features.enableTranslation ? `enabled (${config.features.translateLangs.join(', ')})` : 'disabled'}`)
console.info(`[index] Audio chunk: ${config.audio.chunkDurationSec}s @ ${config.audio.sampleRate}Hz`)

const server = createHttpServer()

server.listen(config.http.port, () => {
    console.info(`[index] HTTP server listening on port ${config.http.port}`)
    console.info(`[index] Ready — POST /start-session to begin captioning a room`)
})

// ── Graceful shutdown ──────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
    console.info(`[index] Received ${signal} — shutting down gracefully`)

    // Stop accepting new connections
    server.close()

    // Flush all active room agents
    const rooms = getActiveRooms()
    if (rooms.length > 0) {
        console.info(`[index] Stopping ${rooms.length} active agents: ${rooms.join(', ')}`)
        await Promise.allSettled(rooms.map((room) => stopRoomAgent(room)))
    }

    console.info('[index] Clean shutdown complete')
    process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', (reason) => {
    console.error('[index] Unhandled rejection:', reason)
    // Don't exit — a single failed caption should not kill the worker
})
