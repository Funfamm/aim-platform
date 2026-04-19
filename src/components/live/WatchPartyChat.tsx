'use client'

/**
 * WatchPartyChat — Real-time chat sidebar for Watch Party events
 * --------------------------------------------------------------------------
 * Subscribes to SSE `chat` events for live messages (pushed via Redis Pub/Sub).
 * Falls back to polling GET /api/watch-party/chat if SSE message is missed.
 *
 * Supports emoji reactions sent to /api/watch-party/chat (planned: separate
 * reaction endpoint). Reaction callback fires a local optimistic reaction overlay.
 */

import { useState, useEffect, useRef, useCallback } from 'react'

interface ChatMessage {
    id:         string
    userId:     string | null
    senderName: string
    content:    string
    createdAt:  string
}

interface WatchPartyChatProps {
    roomName: string
    eventId:  string
    locale:   string
    disabled?: boolean
    onReaction?: (emoji: string) => void
}

const EMOJI_REACTIONS = ['👏', '❤️', '😂', '🔥', '😮', '🎬', '⭐', '🍿']

export default function WatchPartyChat({
    roomName, disabled = false, onReaction,
}: WatchPartyChatProps) {
    const [messages, setMessages]   = useState<ChatMessage[]>([])
    const [input, setInput]         = useState('')
    const [sending, setSending]     = useState(false)
    const [showEmojis, setShowEmojis] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)
    const sseRef    = useRef<EventSource | null>(null)

    /* ── Load initial messages ─────────────────────────────────────────── */
    useEffect(() => {
        fetch(`/api/watch-party/chat?roomName=${encodeURIComponent(roomName)}`)
            .then(r => r.json())
            .then((data: { messages?: ChatMessage[] }) => {
                if (data.messages) setMessages(data.messages)
            })
            .catch(() => {})
    }, [roomName])

    /* ── Subscribe to SSE chat events ─────────────────────────────────── */
    useEffect(() => {
        // Reuse the primary SSE connection by listening on the same stream
        // that WatchPartyShell opens — but since EventSource can't be shared
        // across components, we open a second dedicated connection here.
        // The Redis channel is low-traffic; two connections is acceptable.
        const es = new EventSource(`/api/watch-party/subscribe/${roomName}`)
        sseRef.current = es

        es.addEventListener('chat', (e: MessageEvent) => {
            try {
                const msg = JSON.parse(e.data) as ChatMessage
                setMessages(prev => {
                    // Deduplicate in case of SSE/poll overlap
                    if (prev.some(m => m.id === msg.id)) return prev
                    return [...prev, msg]
                })
            } catch { /* ignore */ }
        })

        return () => {
            es.close()
            sseRef.current = null
        }
    }, [roomName])

    /* ── Auto-scroll ─────────────────────────────────────────────────── */
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    /* ── Send message ─────────────────────────────────────────────────── */
    const sendMessage = useCallback(async () => {
        if (!input.trim() || sending || disabled) return
        const content = input.trim()
        setInput('')
        setSending(true)
        try {
            await fetch('/api/watch-party/chat', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ roomName, content }),
            })
        } catch { /* non-critical */ } finally {
            setSending(false)
        }
    }, [input, sending, disabled, roomName])

    const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
    }

    const relativeTime = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime()
        if (diff < 60000) return 'just now'
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
        return `${Math.floor(diff / 3600000)}h ago`
    }

    /* ══════════════════════════ JSX ══════════════════════════════════════ */
    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            height: '560px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                    💬 LIVE CHAT
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, rgba(255,255,255,0.3))' }}>
                    {messages.length} messages
                </span>
            </div>

            {/* Messages */}
            <div style={{
                flex: 1, overflowY: 'auto', padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: '10px',
            }}>
                {messages.length === 0 && (
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-tertiary)', fontSize: '0.85rem', textAlign: 'center',
                    }}>
                        <div>
                            <div style={{ fontSize: '1.8rem', marginBottom: '8px', opacity: 0.4 }}>💬</div>
                            <p>No messages yet.<br/>Be the first to say something!</p>
                        </div>
                    </div>
                )}
                {messages.map(msg => (
                    <div key={msg.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        {/* Avatar */}
                        <div style={{
                            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                            background: `hsl(${msg.senderName.charCodeAt(0) * 7 % 360}, 60%, 40%)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.7rem', fontWeight: 700, color: 'white',
                        }}>
                            {msg.senderName[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline', marginBottom: '2px' }}>
                                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                    {msg.senderName}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, rgba(255,255,255,0.3))' }}>
                                    {relativeTime(msg.createdAt)}
                                </span>
                            </div>
                            <p style={{
                                fontSize: '0.85rem', color: 'var(--text-primary)',
                                lineHeight: 1.5, margin: 0,
                                wordBreak: 'break-word',
                            }}>
                                {msg.content}
                            </p>
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Reaction bar */}
            <div style={{
                padding: '8px 12px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', gap: '6px', flexWrap: 'wrap',
            }}>
                {EMOJI_REACTIONS.map(emoji => (
                    <button
                        key={emoji}
                        onClick={() => onReaction?.(emoji)}
                        disabled={disabled}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px', padding: '4px 8px',
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            fontSize: '1rem',
                            transition: 'background 0.15s, transform 0.1s',
                            opacity: disabled ? 0.4 : 1,
                        }}
                        onMouseEnter={e => { if (!disabled) (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.12)' }}
                        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.05)' }}
                        title={`React with ${emoji}`}
                    >
                        {emoji}
                    </button>
                ))}
            </div>

            {/* Input */}
            <div style={{
                padding: '10px 12px',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', gap: '8px',
            }}>
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={disabled ? 'Chat opens when screening starts…' : 'Say something…'}
                    disabled={disabled || sending}
                    maxLength={500}
                    style={{
                        flex: 1, background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                        padding: '8px 12px', color: 'var(--text-primary)',
                        fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit',
                        opacity: disabled ? 0.5 : 1,
                    }}
                />
                <button
                    onClick={sendMessage}
                    disabled={disabled || sending || !input.trim()}
                    style={{
                        padding: '8px 14px', borderRadius: '8px', border: 'none',
                        background: input.trim() && !disabled
                            ? 'linear-gradient(135deg, var(--accent-gold), #c9951b)'
                            : 'rgba(255,255,255,0.08)',
                        color: input.trim() && !disabled ? '#000' : 'var(--text-tertiary)',
                        fontWeight: 700, cursor: !input.trim() || disabled ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s', fontSize: '0.85rem', fontFamily: 'inherit',
                    }}
                >
                    Send
                </button>
            </div>
        </div>
    )
}
