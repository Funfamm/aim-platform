import {
    Room,
    RoomEvent,
    RemoteTrack,
    RemoteAudioTrack,
    AudioStream,
    RemoteParticipant,
    RemoteTrackPublication,
} from '@livekit/rtc-node'
import { AccessToken, type VideoGrant } from 'livekit-server-sdk'
import { config } from './config'
import { AudioBuffer } from './audio-buffer'
import { transcribeChunk } from './whisper-stt'
import { translateSegment } from './gemini-translator'
import { CaptionPublisher } from './caption-publisher'

/** Tracks active room agents — roomName → RoomAgent */
const activeAgents = new Map<string, RoomAgent>()

/**
 * RoomAgent: manages a single LiveKit room session for captioning.
 *
 * Lifecycle:
 *   1. Mint a token with agent-specific grants (subscribe audio, publish data)
 *   2. Connect to the room as a hidden, audio-subscribing bot participant
 *   3. For each remote participant: create an AudioBuffer that feeds Whisper
 *   4. On each transcription: translate → publish captions to all topic channels
 *   5. Disconnect when the room ends or after an idle timeout
 */
export class RoomAgent {
    private readonly roomName: string
    private room: Room | null = null
    private readonly audioBuffers = new Map<string, AudioBuffer>()
    private publisher: CaptionPublisher | null = null
    private idleTimer: NodeJS.Timeout | null = null
    private readonly IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 min idle disconnect

    constructor(roomName: string) {
        this.roomName = roomName
    }

    async start(): Promise<void> {
        if (this.room) {
            console.warn(`[room-agent] Already running in ${this.roomName}`)
            return
        }

        const token = await this.mintAgentToken()
        this.room = new Room()
        this.publisher = new CaptionPublisher(this.room)

        this.room.on(RoomEvent.TrackSubscribed, this.onTrackSubscribed.bind(this))
        this.room.on(RoomEvent.TrackUnsubscribed, this.onTrackUnsubscribed.bind(this))
        this.room.on(RoomEvent.ParticipantDisconnected, this.onParticipantDisconnected.bind(this))
        this.room.on(RoomEvent.Disconnected, this.onRoomDisconnected.bind(this))

        await (this.room as Room & { connect(url: string, token: string): Promise<void> })
            .connect(config.livekit.url, token)

        console.info(`[room-agent] Connected to ${this.roomName} as ${config.livekit.agentIdentity}`)
        this.resetIdleTimer()
    }

    async stop(): Promise<void> {
        if (this.idleTimer) clearTimeout(this.idleTimer)

        // Flush any remaining audio before disconnecting
        for (const buffer of this.audioBuffers.values()) {
            buffer.flush()
        }
        this.audioBuffers.clear()

        if (this.room) {
            await (this.room as Room & { disconnect(): Promise<void> }).disconnect()
            this.room = null
        }

        console.info(`[room-agent] Disconnected from ${this.roomName}`)
    }

    // ── Private ──────────────────────────────────────────────────────────────

    private async mintAgentToken(): Promise<string> {
        const grants: VideoGrant = {
            roomJoin: true,
            room: this.roomName,
            canSubscribe: true,
            canPublishData: true,
            // Agent does NOT publish audio/video — only subscribes and publishes data
            canPublish: false,
            hidden: true, // hide from participant list in the UI
            agent: true,
        }

        const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
            identity: `${config.livekit.agentIdentity}-${this.roomName}`,
            name: config.livekit.agentName,
            ttl: '4h',
        })
        at.addGrant(grants)
        // toJwt() is async in livekit-server-sdk v2
        return at.toJwt()
    }

    private onTrackSubscribed(
        track: RemoteTrack,
        _pub: RemoteTrackPublication,
        participant: RemoteParticipant,
    ): void {
        if (!(track instanceof RemoteAudioTrack)) return

        const identity = participant.identity
        const name = participant.name ?? identity

        console.info(`[room-agent] Subscribed to audio from ${identity}`)
        this.resetIdleTimer()

        // Capture publisher at subscription time — protects against null if stop()
        // is called while a Whisper/Gemini await is in flight.
        const publisher = this.publisher!

        const buffer = new AudioBuffer(identity, name, async (chunk) => {
            // Guard: room may have been stopped while awaiting transcription
            if (!this.room) return

            const segment = await transcribeChunk(chunk)
            if (!segment || !this.room) return

            await publisher.publishOriginal(segment)

            const translations = await translateSegment(segment)
            if (!this.room) return

            await publisher.publishTranslations(translations)

            console.info(
                `[room-agent] ${identity}: "${segment.originalText.slice(0, 80)}" → ${translations.length} translations`,
            )
        })

        this.audioBuffers.set(identity, buffer)

        // Start consuming audio frames from the LiveKit AudioStream
        this.consumeAudioStream(track, buffer)
    }

    private onTrackUnsubscribed(
        _track: RemoteTrack,
        _pub: RemoteTrackPublication,
        participant: RemoteParticipant,
    ): void {
        const buffer = this.audioBuffers.get(participant.identity)
        if (buffer) {
            buffer.flush()
            this.audioBuffers.delete(participant.identity)
        }
    }

    private onParticipantDisconnected(participant: RemoteParticipant): void {
        // onTrackUnsubscribed already owns flush + delete for this participant.
        // Doing it again here would double-flush the last audio chunk.
        console.info(`[room-agent] Participant left: ${participant.identity}`)
    }

    private onRoomDisconnected(): void {
        console.info(`[room-agent] Room ${this.roomName} ended — cleaning up`)
        // Clear idle timer — prevents a ghost stop() call 30 min after room ends
        if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null }
        this.audioBuffers.clear()
        this.room = null
        activeAgents.delete(this.roomName)
    }

    private async consumeAudioStream(track: RemoteTrack, buffer: AudioBuffer): Promise<void> {
        try {
            const audioStream = new AudioStream(
                track,
                config.audio.sampleRate,
                config.audio.numChannels,
            )
            for await (const frame of audioStream) {
                // frame.data is Int16Array — push directly to the buffer
                buffer.push(frame.data)
            }
        } catch (err) {
            // Stream ends when the track is unsubscribed — this is expected
            console.debug(`[room-agent] Audio stream closed for track`, err)
        }
    }

    private resetIdleTimer(): void {
        if (this.idleTimer) clearTimeout(this.idleTimer)
        this.idleTimer = setTimeout(async () => {
            console.warn(`[room-agent] Idle timeout for ${this.roomName} — disconnecting`)
            await this.stop()
            activeAgents.delete(this.roomName)
        }, this.IDLE_TIMEOUT_MS)
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Start captioning a room if not already active. Idempotent. */
export async function startRoomAgent(roomName: string): Promise<void> {
    if (activeAgents.has(roomName)) {
        console.info(`[room-agent] Agent already active for ${roomName}`)
        return
    }
    const agent = new RoomAgent(roomName)
    // Connect first — if start() throws, activeAgents is never polluted
    // with a dead entry that would block future /start-session calls.
    await agent.start()
    activeAgents.set(roomName, agent)
}

/** Stop captioning a specific room. */
export async function stopRoomAgent(roomName: string): Promise<void> {
    const agent = activeAgents.get(roomName)
    if (!agent) return
    await agent.stop()
    activeAgents.delete(roomName)
}

/** Returns the names of all currently active rooms. */
export function getActiveRooms(): string[] {
    return [...activeAgents.keys()]
}
