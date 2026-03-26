'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Props {
    audioFile: File | null
    onAudioChange: (file: File | null) => void
}

const MAX_RECORDING_SECS = 120

export default function VoiceRecorder({ audioFile, onAudioChange }: Props) {
    const [voiceMode, setVoiceMode] = useState<'record' | 'upload'>('record')
    const [isRecording, setIsRecording] = useState(false)
    const [recordingTime, setRecordingTime] = useState(0)
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
    const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
    const [micError, setMicError] = useState('')
    const [uploadError, setUploadError] = useState('')

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const audioInputRef = useRef<HTMLInputElement | null>(null)

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
        }
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
        setIsRecording(false)
    }, [])

    const startRecording = useCallback(async () => {
        setMicError('')
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []

            mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }

            mediaRecorder.onstop = () => {
                stream.getTracks().forEach(t => t.stop())
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
                setRecordedBlob(blob)
                const url = URL.createObjectURL(blob)
                setRecordedUrl(url)
                const file = new File([blob], 'voice-recording.webm', { type: 'audio/webm' })
                onAudioChange(file)
            }

            mediaRecorder.start(250)
            setIsRecording(true)
            setRecordingTime(0)
            setRecordedBlob(null)
            setRecordedUrl(null)

            timerRef.current = setInterval(() => {
                setRecordingTime(prev => {
                    if (prev >= MAX_RECORDING_SECS - 1) {
                        stopRecording()
                        return MAX_RECORDING_SECS
                    }
                    return prev + 1
                })
            }, 1000)
        } catch {
            setMicError('Microphone access denied. Please allow microphone access in your browser settings.')
        }
    }, [stopRecording, onAudioChange])

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            if (recordedUrl) URL.revokeObjectURL(recordedUrl)
        }
    }, [recordedUrl])

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60)
        const s = secs % 60
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith('audio/')) {
            setUploadError('Please upload an audio file only (MP3, WAV, M4A, etc.)')
            return
        }
        if (file.size > 50 * 1024 * 1024) {
            setUploadError('Audio file must be under 50MB')
            return
        }
        setUploadError('')
        onAudioChange(file)
    }

    return (
        <div style={{
            padding: 'var(--space-xl)',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
            marginBottom: 'var(--space-2xl)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                <span style={{ fontSize: '1.5rem' }}>🎙️</span>
                <div>
                    <div style={{ fontWeight: 600 }}>Voice Recording *</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>For voice cloning and character matching</div>
                </div>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)', lineHeight: 1.7 }}>
                Record yourself speaking naturally for up to <strong>2 minutes</strong>. You can read a passage, introduce yourself,
                or perform a short monologue. Clear audio without background noise produces the best results.
            </p>

            {uploadError && (
                <div style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.82rem', color: '#ef4444',
                    marginBottom: 'var(--space-md)',
                }}>⚠️ {uploadError}</div>
            )}

            {/* Record / Upload Toggle */}
            <div style={{
                display: 'flex', gap: '2px',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-md)',
                padding: '3px',
                marginBottom: 'var(--space-lg)',
            }}>
                {(['record', 'upload'] as const).map(mode => (
                    <button
                        key={mode}
                        type="button"
                        onClick={() => setVoiceMode(mode)}
                        style={{
                            flex: 1, padding: '0.5rem 1rem',
                            borderRadius: 'var(--radius-sm)',
                            border: 'none', cursor: 'pointer',
                            fontSize: '0.82rem', fontWeight: 600,
                            background: voiceMode === mode ? 'var(--accent-gold-glow)' : 'transparent',
                            color: voiceMode === mode ? 'var(--accent-gold)' : 'var(--text-tertiary)',
                            transition: 'all 0.2s',
                        }}
                    >
                        {mode === 'record' ? '🎤 Record' : '📁 Upload File'}
                    </button>
                ))}
            </div>

            {/* RECORD MODE */}
            {voiceMode === 'record' && (
                <div>
                    {micError && (
                        <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.82rem', color: '#ef4444',
                            marginBottom: 'var(--space-md)',
                        }}>⚠️ {micError}</div>
                    )}

                    <div style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: 'var(--space-xl)',
                        background: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-lg)',
                        border: `1px solid ${isRecording ? 'rgba(239,68,68,0.3)' : 'var(--border-subtle)'}`,
                    }}>
                        {/* Waveform */}
                        {isRecording && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '40px', marginBottom: 'var(--space-md)' }}>
                                {Array.from({ length: 20 }).map((_, i) => (
                                    <div key={i} style={{
                                        width: '3px',
                                        background: 'var(--accent-gold)',
                                        borderRadius: '2px',
                                        animation: `waveform 0.8s ease-in-out ${i * 0.05}s infinite alternate`,
                                        height: `${12 + Math.random() * 28}px`,
                                    }} />
                                ))}
                                <style>{`
                                    @keyframes waveform {
                                        from { height: 6px; opacity: 0.4; }
                                        to { height: 36px; opacity: 1; }
                                    }
                                `}</style>
                            </div>
                        )}

                        {/* Timer */}
                        {(isRecording || recordedBlob) && (
                            <div style={{
                                fontSize: '1.8rem', fontWeight: 700,
                                fontFamily: 'monospace',
                                color: isRecording ? '#ef4444' : 'var(--accent-gold)',
                                marginBottom: 'var(--space-md)',
                                display: 'flex', alignItems: 'center', gap: 'var(--space-sm)',
                            }}>
                                {isRecording && (
                                    <span style={{
                                        width: '10px', height: '10px', borderRadius: '50%',
                                        background: '#ef4444',
                                        animation: 'pulse 1s infinite',
                                    }} />
                                )}
                                {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_SECS)}
                            </div>
                        )}

                        {/* Record / Stop button */}
                        <button
                            type="button"
                            onClick={isRecording ? stopRecording : startRecording}
                            style={{
                                width: '64px', height: '64px', borderRadius: '50%',
                                border: `3px solid ${isRecording ? '#ef4444' : 'var(--accent-gold)'}`,
                                background: isRecording ? 'rgba(239,68,68,0.1)' : 'var(--accent-gold-glow)',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s',
                            }}
                        >
                            {isRecording ? (
                                <div style={{ width: '20px', height: '20px', borderRadius: '3px', background: '#ef4444' }} />
                            ) : (
                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent-gold)' }} />
                            )}
                        </button>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: 'var(--space-sm)' }}>
                            {isRecording ? 'Tap to stop recording' : recordedBlob ? 'Tap to re-record' : 'Tap to start recording'}
                        </div>

                        {/* Playback preview */}
                        {recordedUrl && !isRecording && (
                            <div style={{ width: '100%', marginTop: 'var(--space-lg)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, marginBottom: '6px' }}>
                                    ✓ Recording captured — preview below
                                </div>
                                <audio controls src={recordedUrl} style={{ width: '100%' }} />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* UPLOAD MODE */}
            {voiceMode === 'upload' && (
                <>
                    <div
                        className={`file-upload-zone ${audioFile ? 'has-file' : ''}`}
                        onClick={() => audioInputRef.current?.click()}
                        style={{ padding: 'var(--space-lg)' }}
                    >
                        {audioFile && voiceMode === 'upload' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
                                <span style={{ fontSize: '1.5rem' }}>🎵</span>
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--success)' }}>✓ {audioFile.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                        {(audioFile.size / (1024 * 1024)).toFixed(1)}MB • Click to replace
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="file-upload-icon">🎤</div>
                                <div className="file-upload-text">Click to upload your voice recording</div>
                                <div className="file-upload-hint">MP3, WAV, M4A, OGG, or FLAC • Max 2 minutes • Max 50MB</div>
                            </>
                        )}
                    </div>
                    <input
                        ref={audioInputRef}
                        type="file"
                        accept="audio/*"
                        style={{ display: 'none' }}
                        onChange={handleAudioUpload}
                    />
                </>
            )}
        </div>
    )
}
