import http from 'http'
import { config } from './config'
import { startRoomAgent, stopRoomAgent, getActiveRooms } from './room-agent'
import { checkGeminiHealth } from './gemini-translator'
import type { StartSessionPayload } from './types'

/**
 * Lightweight HTTP server that receives commands from the Next.js app.
 *
 * Endpoints:
 *   POST /start-session   — begin captioning a room
 *   POST /stop-session    — stop captioning a room
 *   GET  /health          — liveness + dependency health check
 *   GET  /status          — list active rooms
 */
export function createHttpServer(): http.Server {
    const server = http.createServer(async (req, res) => {
        const url = new URL(req.url ?? '/', `http://localhost:${config.http.port}`)

        // ── Auth: verify shared secret on mutation endpoints ──────────────────
        if (req.method !== 'GET') {
            const authHeader = req.headers['x-worker-secret']
            if (authHeader !== config.http.webhookSecret) {
                respond(res, 401, { error: 'Unauthorized' })
                return
            }
        }

        // ── POST /start-session ──────────────────────────────────────────────
        if (req.method === 'POST' && url.pathname === '/start-session') {
            let body: StartSessionPayload
            try {
                body = await readJson<StartSessionPayload>(req)
            } catch {
                respond(res, 400, { error: 'Invalid JSON body' })
                return
            }

            if (!body.roomName) {
                respond(res, 400, { error: 'roomName is required' })
                return
            }

            console.info(`[http] Starting caption session for room: ${body.roomName}`)
            // Don't await — let it run in the background
            startRoomAgent(body.roomName).catch((err) => {
                console.error(`[http] startRoomAgent failed for ${body.roomName}`, err)
            })

            respond(res, 202, { ok: true, roomName: body.roomName, status: 'starting' })
            return
        }

        // ── POST /stop-session ───────────────────────────────────────────────
        if (req.method === 'POST' && url.pathname === '/stop-session') {
            let body: { roomName: string }
            try {
                body = await readJson<{ roomName: string }>(req)
            } catch {
                respond(res, 400, { error: 'Invalid JSON body' })
                return
            }

            await stopRoomAgent(body.roomName)
            respond(res, 200, { ok: true, roomName: body.roomName })
            return
        }

        // ── GET /health ──────────────────────────────────────────────────────
        if (req.method === 'GET' && url.pathname === '/health') {
            const geminiOk = await checkGeminiHealth().catch(() => false)
            const status = geminiOk ? 'ok' : 'degraded'
            respond(res, geminiOk ? 200 : 503, {
                status,
                activeRooms: getActiveRooms().length,
                whisperModel: config.openai.model,
                geminiModel: config.gemini.model,
                translationEnabled: config.features.enableTranslation,
                geminiHealthy: geminiOk,
                uptime: Math.floor(process.uptime()),
            })
            return
        }

        // ── GET /status ──────────────────────────────────────────────────────
        if (req.method === 'GET' && url.pathname === '/status') {
            respond(res, 200, { activeRooms: getActiveRooms() })
            return
        }

        respond(res, 404, { error: 'Not found' })
    })

    return server
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function respond(res: http.ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
}

function readJson<T>(req: http.IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
        let data = ''
        const MAX_BYTES = 64 * 1024 // 64 KB — more than enough for any caption session payload
        req.on('data', (chunk: Buffer) => {
            data += chunk.toString()
            if (data.length > MAX_BYTES) {
                req.destroy()
                reject(new Error('Request body too large'))
            }
        })
        req.on('end', () => {
            try { resolve(JSON.parse(data) as T) }
            catch { reject(new Error('Invalid JSON')) }
        })
        req.on('error', reject)
    })
}
