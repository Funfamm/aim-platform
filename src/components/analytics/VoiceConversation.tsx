'use client'

import { useState, useEffect, useRef } from 'react'

// Type shims for Web Speech API (not in default TS DOM types)
/* eslint-disable @typescript-eslint/no-explicit-any */
type SR = any   // SpeechRecognition instance
type SREvent = any  // SpeechRecognitionEvent  
type SRError = any  // SpeechRecognitionErrorEvent

interface Props {
    onClose: () => void
    insightContext: string
}

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking'

export default function VoiceConversation({ onClose, insightContext }: Props) {
    const [phase, setPhase] = useState<Phase>('idle')
    const [transcript, setTranscript] = useState('')
    const [interimTranscript, setInterimTranscript] = useState('')
    const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([{
        role: 'ai',
        text: 'Hey! I\'m your AIM Studio analytics advisor. I can see your platform data — ask me anything about your traffic, casting pipeline, or how to grow your audience.'
    }])
    const [volume, setVolume] = useState(0)
    const [ttsProvider, setTtsProvider] = useState<'elevenlabs' | 'openai' | 'browser'>('browser')
    const [voices, setVoices] = useState<{ voiceId: string; name: string }[]>([])
    const [selectedVoiceId, _setSelectedVoiceId] = useState<string>(() => {
        try { return localStorage.getItem('aim_tts_voice') ?? '' } catch { return '' }
    })
    const selectedVoiceIdRef = useRef(selectedVoiceId)
    const setSelectedVoiceId = (id: string) => {
        selectedVoiceIdRef.current = id
        _setSelectedVoiceId(id)
    }

    const setPhaseSync = (p: Phase) => {
        phaseRef.current = p
        setPhase(p)
    }

    const recognitionRef = useRef<SR | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const micStreamRef = useRef<MediaStream | null>(null)
    const animFrameRef = useRef<number>(0)
    const currentAudioRef = useRef<HTMLAudioElement | null>(null)
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const autoListenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const transcriptRef = useRef('')
    const phaseRef = useRef<Phase>('idle')
    const bargeInCountRef = useRef(0)
    const speakResolveRef = useRef<(() => void) | null>(null)
    const bargedInRef = useRef(false)
    const bargeInListeningRef = useRef(false)
    const idleWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        return () => { stopEverything() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        let cancelled = false

        const init = async () => {
            try {
                const r = await fetch('/api/admin/analytics/voices')
                const d = await r.json()
                if (!cancelled && d.voices?.length) {
                    setVoices(d.voices)
                    const saved = localStorage.getItem('aim_tts_voice')
                    const match = d.voices.find((v: { voiceId: string }) => v.voiceId === saved)
                    setSelectedVoiceId(match?.voiceId ?? d.voices[0].voiceId)
                }
            } catch { /* no voices available */ }

            await new Promise(r => setTimeout(r, 100))

            if (cancelled) return
            const greeting = messages[0]?.text ?? ''
            if (greeting) {
                if (window.speechSynthesis) window.speechSynthesis.cancel()
                let listeningStarted = false
                const beginListening = () => {
                    if (listeningStarted || cancelled) return
                    listeningStarted = true
                    currentAudioRef.current?.pause()
                    currentAudioRef.current = null
                    if (window.speechSynthesis) window.speechSynthesis.cancel()
                    speakResolveRef.current?.()
                    speakResolveRef.current = null
                    setPhaseSync('idle')
                    startListening()
                }
                speakResponse(greeting).then(beginListening)
                setTimeout(beginListening, 3000)
            }
        }

        init()
        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const stopEverything = () => {
        recognitionRef.current?.stop()
        recognitionRef.current?.abort()
        currentAudioRef.current?.pause()
        micStreamRef.current?.getTracks().forEach(t => t.stop())
        audioContextRef.current?.close()
        cancelAnimationFrame(animFrameRef.current)
        if (autoListenTimeoutRef.current) clearTimeout(autoListenTimeoutRef.current)
        if (idleWatchdogRef.current) clearTimeout(idleWatchdogRef.current)
        setVolume(0)
    }

    const resetIdleWatchdog = () => {
        if (idleWatchdogRef.current) clearTimeout(idleWatchdogRef.current)
        idleWatchdogRef.current = setTimeout(() => {
            if (phaseRef.current === 'idle') startListening()
        }, 4000)
    }

    const startVolumeMeter = async () => {
        stopVolumeMeter()
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            micStreamRef.current = stream
            const ctx = new AudioContext()
            audioContextRef.current = ctx
            const analyser = ctx.createAnalyser()
            analyserRef.current = analyser
            analyser.fftSize = 256
            ctx.createMediaStreamSource(stream).connect(analyser)
            const data = new Uint8Array(analyser.frequencyBinCount)
            const tick = () => {
                analyser.getByteTimeDomainData(data)
                let sum = 0
                for (const v of data) sum += Math.abs(v - 128)
                const vol = Math.min(sum / data.length / 30, 1)
                setVolume(vol)

                if (phaseRef.current === 'speaking' && vol > 0.35) {
                    bargeInCountRef.current += 1
                    if (bargeInCountRef.current >= 2) {
                        bargeInCountRef.current = 0
                        bargedInRef.current = true
                        bargeInListeningRef.current = true
                        currentAudioRef.current?.pause()
                        currentAudioRef.current = null
                        if (window.speechSynthesis) window.speechSynthesis.cancel()
                        speakResolveRef.current?.()
                        speakResolveRef.current = null
                        setPhaseSync('idle')
                        autoListenTimeoutRef.current = setTimeout(() => startListening(), 150)
                        resetIdleWatchdog()
                        return
                    }
                } else {
                    bargeInCountRef.current = 0
                }

                animFrameRef.current = requestAnimationFrame(tick)
            }
            tick()
        } catch { /* mic denied */ }
    }

    const stopVolumeMeter = () => {
        cancelAnimationFrame(animFrameRef.current)
        micStreamRef.current?.getTracks().forEach(t => t.stop())
        audioContextRef.current?.close().catch(() => {})
        micStreamRef.current = null
        audioContextRef.current = null
        setVolume(0)
    }

    const speakResponse = async (text: string): Promise<void> => {
        return new Promise(async (resolve) => {
            if (currentAudioRef.current) {
                currentAudioRef.current.pause()
                currentAudioRef.current = null
            }
            if (window.speechSynthesis) window.speechSynthesis.cancel()
            if (speakResolveRef.current) {
                speakResolveRef.current()
                speakResolveRef.current = null
            }

            speakResolveRef.current = resolve
            setPhaseSync('speaking')
            bargeInCountRef.current = 0
            startVolumeMeter()

            const safetyTimer = setTimeout(() => {
                if (speakResolveRef.current === resolve) {
                    currentAudioRef.current?.pause()
                    currentAudioRef.current = null
                    if (window.speechSynthesis) window.speechSynthesis.cancel()
                    speakResolveRef.current?.()
                    speakResolveRef.current = null
                }
            }, 15000)

            try {
                const res = await fetch('/api/admin/analytics/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, voiceId: selectedVoiceIdRef.current || undefined }),
                })

                const contentType = res.headers.get('content-type') || ''
                if (contentType.includes('audio')) {
                    const provider = res.headers.get('x-tts-provider') || 'openai'
                    setTtsProvider(provider === 'elevenlabs' ? 'elevenlabs' : 'openai')
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const audio = new Audio(url)
                    currentAudioRef.current = audio
                    audio.onended = () => { clearTimeout(safetyTimer); URL.revokeObjectURL(url); speakResolveRef.current?.(); speakResolveRef.current = null }
                    audio.onerror = () => { clearTimeout(safetyTimer); speakResolveRef.current?.(); speakResolveRef.current = null }
                    audio.play().catch(() => { clearTimeout(safetyTimer); speakResolveRef.current?.(); speakResolveRef.current = null })
                    return
                }
            } catch { /* fall through to browser TTS */ }

            setTtsProvider('browser')
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.cancel()
                const utt = new SpeechSynthesisUtterance(text)
                utt.rate = 0.95; utt.pitch = 1.05
                const voices = window.speechSynthesis.getVoices()
                const best = voices.find(v =>
                    v.name.includes('Google') && v.lang.startsWith('en')
                ) || voices.find(v => v.lang === 'en-US') || voices[0]
                if (best) utt.voice = best
                utt.onend = () => { clearTimeout(safetyTimer); speakResolveRef.current?.(); speakResolveRef.current = null }
                utt.onerror = () => { clearTimeout(safetyTimer); speakResolveRef.current?.(); speakResolveRef.current = null }
                window.speechSynthesis.speak(utt)
            } else {
                speakResolveRef.current?.()
                speakResolveRef.current = null
            }
        })
    }

    const sendToAI = async (userText: string) => {
        setPhaseSync('thinking')
        const history = [...messages, { role: 'user' as const, text: userText }]
        setMessages(history)

        try {
            const res = await fetch('/api/admin/analytics/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: userText, context: insightContext }),
            })
            const result = await res.json()
            const answer = result.answer || 'Sorry, I couldn\'t get a response. Try again?'
            setMessages(prev => [...prev, { role: 'ai', text: answer }])
            await speakResponse(answer)
        } catch {
            const errMsg = 'I hit a snag. Can you try asking again?'
            setMessages(prev => [...prev, { role: 'ai', text: errMsg }])
            await speakResponse(errMsg)
        }

        if (!bargedInRef.current) {
            setPhaseSync('idle')
            autoListenTimeoutRef.current = setTimeout(() => startListening(), 600)
            resetIdleWatchdog()
        }
        bargedInRef.current = false
    }

    const startListening = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any
        const SR = w.SpeechRecognition || w.webkitSpeechRecognition
        if (!SR) { alert('Voice recognition not supported in this browser. Use Google Chrome.'); return }

        currentAudioRef.current?.pause()
        if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()

        const recognition = new SR()
        recognitionRef.current = recognition
        recognition.continuous = false
        recognition.interimResults = true
        recognition.lang = 'en-US'
        recognition.maxAlternatives = 1

        setPhaseSync('listening')
        transcriptRef.current = ''
        setTranscript('')
        setInterimTranscript('')
        startVolumeMeter()

        recognition.onresult = (e: SREvent) => {
            let interim = ''
            let final = ''
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const t = e.results[i][0].transcript
                if (e.results[i].isFinal) final += t
                else interim += t
            }
            if (final) {
                transcriptRef.current += final
                setTranscript(transcriptRef.current)
            }
            setInterimTranscript(interim)
        }

        recognition.onend = () => {
            stopVolumeMeter()
            setInterimTranscript('')
            const finalText = transcriptRef.current.trim()
            transcriptRef.current = ''
            setTranscript('')
            const wasBargeIn = bargeInListeningRef.current
            bargeInListeningRef.current = false

            if (finalText.length > 2) {
                sendToAI(finalText)
            } else if (wasBargeIn) {
                setPhaseSync('idle')
                autoListenTimeoutRef.current = setTimeout(() => startListening(), 300)
            } else {
                setPhaseSync('idle')
            }
        }

        recognition.onerror = (e: SRError) => {
            stopVolumeMeter()
            bargeInListeningRef.current = false
            if (e.error === 'no-speech') {
                autoListenTimeoutRef.current = setTimeout(() => startListening(), 300)
            } else if (e.error !== 'aborted') {
                setPhaseSync('idle')
            }
        }

        recognition.start()
    }

    const stopListening = () => {
        recognitionRef.current?.stop()
    }

    const toggleListening = () => {
        if (autoListenTimeoutRef.current) clearTimeout(autoListenTimeoutRef.current)
        if (phase === 'listening') { stopListening(); return }
        if (phase === 'speaking') {
            currentAudioRef.current?.pause()
            window.speechSynthesis?.cancel()
        }
        startListening()
    }

    const selectedVoiceName = voices.find(v => v.voiceId === selectedVoiceId)?.name ?? 'ElevenLabs'
    const ttsLabel = ttsProvider === 'elevenlabs' ? `🎙️ ${selectedVoiceName}` : ttsProvider === 'openai' ? '🔊 OpenAI (nova)' : '🔊 Speaking…'
    const phaseColors = {
        idle: { orb: '#1a1a2e', ring: 'rgba(212,168,83,0.3)', label: 'Tap to speak', pulse: false },
        listening: { orb: '#0f2027', ring: '#d4a853', label: 'Listening…', pulse: true },
        thinking: { orb: '#1a0f2e', ring: '#a855f7', label: 'Thinking…', pulse: true },
        speaking: { orb: '#0a1f1a', ring: '#22c55e', label: ttsLabel, pulse: true },
    }
    const pc = phaseColors[phase]
    const orbScale = 1 + volume * 0.4

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.92)',
            backdropFilter: 'blur(20px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
            {/* Header */}
            <div style={{
                width: '100%', display: 'flex', alignItems: 'center', padding: '20px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--accent-gold)' }}>AIM Studio Analytics Agent</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>Voice conversation · {ttsProvider === 'elevenlabs' ? `🎙️ ElevenLabs · ${selectedVoiceName}` : ttsProvider === 'openai' ? '🟢 OpenAI TTS' : '🌎 Browser voice'}</div>
                </div>

                {voices.length > 0 && (
                    <select
                        value={selectedVoiceId}
                        onChange={e => {
                            setSelectedVoiceId(e.target.value)
                            try { localStorage.setItem('aim_tts_voice', e.target.value) } catch {}
                        }}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'var(--text-secondary)',
                            padding: '5px 10px',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            marginRight: '10px',
                            maxWidth: '160px',
                        }}
                    >
                        {voices.map(v => (
                            <option key={v.voiceId} value={v.voiceId}>{v.name}</option>
                        ))}
                    </select>
                )}

                <button onClick={() => { stopEverything(); onClose() }} style={{
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text-secondary)', padding: '6px 14px', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                }}>✕ End Call</button>
            </div>

            {/* Main area */}
            <div style={{ flex: 1, display: 'flex', width: '100%', maxWidth: '900px', overflow: 'hidden', padding: '24px', gap: '24px' }}>

                {/* Left: Orb + mic */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '280px', gap: '28px', flexShrink: 0 }}>

                    {/* Animated orb */}
                    <div
                        onClick={toggleListening}
                        style={{
                            position: 'relative',
                            width: '180px', height: '180px',
                            cursor: 'pointer',
                            userSelect: 'none',
                        }}
                    >
                        {pc.pulse && [
                            { size: 220, delay: '0s', opacity: 0.15 },
                            { size: 250, delay: '0.4s', opacity: 0.09 },
                            { size: 280, delay: '0.8s', opacity: 0.05 },
                        ].map((ring, i) => (
                            <div key={i} style={{
                                position: 'absolute',
                                left: `${(180 - ring.size) / 2}px`,
                                top: `${(180 - ring.size) / 2}px`,
                                width: `${ring.size}px`,
                                height: `${ring.size}px`,
                                borderRadius: '50%',
                                border: `1.5px solid ${pc.ring}`,
                                opacity: ring.opacity,
                                animation: `voicePulse 2s ease-out ${ring.delay} infinite`,
                            }} />
                        ))}

                        <div style={{
                            position: 'absolute', inset: 0,
                            borderRadius: '50%',
                            background: `radial-gradient(circle at 38% 38%, ${pc.ring}30, ${pc.orb} 70%)`,
                            border: `2px solid ${pc.ring}`,
                            boxShadow: `0 0 40px ${pc.ring}30, inset 0 0 40px rgba(0,0,0,0.5)`,
                            transform: `scale(${orbScale})`,
                            transition: 'transform 0.05s, background 0.5s, border-color 0.5s, box-shadow 0.5s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '3rem',
                        }}>
                            {phase === 'thinking' ? '✦' : phase === 'speaking' ? '🔊' : '🎙'}
                        </div>
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            fontSize: '0.9rem', fontWeight: 700,
                            color: pc.ring, letterSpacing: '0.02em',
                            transition: 'color 0.4s',
                        }}>{pc.label}</div>
                        {(transcript || interimTranscript) && (
                            <div style={{
                                marginTop: '10px', fontSize: '0.75rem',
                                color: 'var(--text-secondary)', lineHeight: 1.5,
                                maxWidth: '240px', textAlign: 'center',
                            }}>
                                {transcript}
                                <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>{interimTranscript}</span>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '32px' }}>
                        {Array.from({ length: 12 }).map((_, i) => {
                            const h = phase === 'listening'
                                ? Math.max(4, volume * 32 * (0.5 + 0.5 * Math.sin(Date.now() / 80 + i)))
                                : phase === 'speaking' ? Math.max(4, 8 + Math.sin(Date.now() / 100 + i * 0.8) * 8) : 4
                            return (
                                <div key={i} style={{
                                    width: '3px', height: `${h}px`, borderRadius: '2px',
                                    background: pc.ring,
                                    opacity: phase === 'idle' ? 0.2 : 0.7,
                                    transition: 'height 0.05s, background 0.4s',
                                }} />
                            )
                        })}
                    </div>

                    <div style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
                        {phase === 'idle' ? 'Tap orb or button to start' : ''}
                        {phase === 'listening' ? 'Tap again to stop & send' : ''}
                        {phase === 'thinking' ? 'Analyzing your data…' : ''}
                        {phase === 'speaking' ? 'Tap to interrupt & speak' : ''}
                    </div>
                </div>

                {/* Right: Conversation transcript */}
                <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 'var(--radius-xl)',
                    overflow: 'hidden',
                }}>
                    <div style={{
                        padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                        fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.1em', color: 'var(--text-tertiary)',
                    }}>Conversation</div>

                    <div style={{
                        flex: 1, overflowY: 'auto', padding: '16px',
                        display: 'flex', flexDirection: 'column', gap: '14px',
                    }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{
                                display: 'flex', gap: '10px',
                                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                alignItems: 'flex-start',
                            }}>
                                <div style={{
                                    width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.85rem',
                                    background: msg.role === 'user'
                                        ? 'rgba(212,168,83,0.15)'
                                        : 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(34,197,94,0.1))',
                                    border: `1px solid ${msg.role === 'user' ? 'rgba(212,168,83,0.2)' : 'rgba(139,92,246,0.2)'}`,
                                }}>
                                    {msg.role === 'user' ? '👤' : '🤖'}
                                </div>
                                <div style={{
                                    maxWidth: '80%', padding: '10px 14px',
                                    borderRadius: msg.role === 'user' ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                                    background: msg.role === 'user'
                                        ? 'rgba(212,168,83,0.08)'
                                        : 'rgba(139,92,246,0.06)',
                                    border: `1px solid ${msg.role === 'user' ? 'rgba(212,168,83,0.12)' : 'rgba(139,92,246,0.1)'}`,
                                    fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6,
                                }}>{msg.text}</div>
                            </div>
                        ))}
                        {phase === 'thinking' && (
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <div style={{
                                    width: '30px', height: '30px', borderRadius: '50%',
                                    background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(34,197,94,0.1))',
                                    border: '1px solid rgba(139,92,246,0.2)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem',
                                }}>🤖</div>
                                <div style={{ padding: '10px 14px', borderRadius: '4px 16px 16px 16px', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.1)', display: 'flex', gap: '5px', alignItems: 'center' }}>
                                    {[0, 0.2, 0.4].map(d => (
                                        <div key={d} style={{
                                            width: '6px', height: '6px', borderRadius: '50%', background: '#a855f7',
                                            animation: `voiceDot 1.2s ease-in-out ${d}s infinite`,
                                        }} />
                                    ))}
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes voicePulse {
                    0% { transform: scale(0.95); opacity: 0.8; }
                    100% { transform: scale(1.4); opacity: 0; }
                }
                @keyframes voiceDot {
                    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
                    40% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    )
}
