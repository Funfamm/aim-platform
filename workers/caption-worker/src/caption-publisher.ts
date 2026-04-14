import type { Room } from '@livekit/rtc-node'
import type { CaptionSegment, TranslatedCaption } from './types'
import { CAPTION_TOPICS } from './types'

/**
 * Encodes and publishes a caption segment to the LiveKit room data channel.
 * All participants subscribe to their preferred language topic via CaptionOverlay.tsx.
 */
export class CaptionPublisher {
    private readonly room: Room

    constructor(room: Room) {
        this.room = room
    }

    /**
     * Publishes the original transcription to the captions.original topic.
     */
    async publishOriginal(segment: CaptionSegment): Promise<void> {
        await this.publish(CAPTION_TOPICS.original, segment.originalText, segment.speakerIdentity)
    }

    /**
     * Publishes a translated caption to its target language topic.
     */
    async publishTranslation(translated: TranslatedCaption): Promise<void> {
        const topic = CAPTION_TOPICS[translated.targetLang as keyof typeof CAPTION_TOPICS]
        if (!topic) {
            console.warn(`[publisher] Unknown target lang: ${translated.targetLang}`)
            return
        }
        await this.publish(topic, translated.translatedText, translated.segment.speakerIdentity)
    }

    /**
     * Publishes a batch of translations (the full output of translateSegment).
     */
    async publishTranslations(translations: TranslatedCaption[]): Promise<void> {
        await Promise.allSettled(
            translations.map((t) => this.publishTranslation(t)),
        )
    }

    private async publish(topic: string, text: string, senderIdentity: string): Promise<void> {
        const payload = new TextEncoder().encode(text)
        try {
            await this.room.localParticipant?.publishData(payload, {
                reliable: true,          // guaranteed delivery for captions
                topic,
                destination_identities: [], // empty = broadcast to all participants
            })
            console.debug(`[publisher] ${topic} → "${text.slice(0, 60)}..." (from: ${senderIdentity})`)
        } catch (err) {
            console.error(`[publisher] Failed to publish to ${topic}`, err)
        }
    }
}
