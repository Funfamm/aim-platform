'use client'

import { useEffect, useRef } from 'react'
import { CAPTION_TOPICS, type CaptionLang } from '@/lib/livekit/translation-adapter'

const LANG_LABELS: Record<CaptionLang, string> = {
    original: 'Original',
    en: 'English',
    ar: 'العربية',
    de: 'Deutsch',
    es: 'Español',
    fr: 'Français',
    hi: 'हिन्दी',
    ja: '日本語',
    ko: '한국어',
    pt: 'Português',
    ru: 'Русский',
    zh: '中文',
}

const LANGS = Object.keys(CAPTION_TOPICS) as CaptionLang[]

interface LanguageSelectorProps {
    value: CaptionLang
    onChange: (lang: CaptionLang) => void
}

export default function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
    // Keep a ref to onChange so the mount-only useEffect below never captures a stale closure,
    // even if the parent re-creates the callback between renders.
    const onChangeRef = useRef(onChange)
    useEffect(() => { onChangeRef.current = onChange }, [onChange])

    // Hydrate from user's saved preference on mount — reads via ref, not closure.
    useEffect(() => {
        fetch('/api/captions/preferences')
            .then((r) => r.ok ? r.json() : null)
            .then((data) => {
                if (data?.lang && LANGS.includes(data.lang)) {
                    onChangeRef.current(data.lang as CaptionLang)
                }
            })
            .catch(() => {/* silent — default to 'en' */})
    }, []) // intentionally mount-only; onChange consumed via ref

    const handleChange = async (lang: CaptionLang) => {
        onChange(lang)
        // Persist to user profile — fire-and-forget
        try {
            await fetch('/api/captions/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lang }),
            })
        } catch {
            // Preference save is non-critical — selection still takes effect locally
        }
    }

    return (
        <div className="language-selector">
            <label htmlFor="caption-lang-select" className="language-selector-label">
                Captions
            </label>
            <select
                id="caption-lang-select"
                value={value}
                onChange={(e) => handleChange(e.target.value as CaptionLang)}
                className="language-selector-select"
                aria-label="Select caption language"
            >
                {LANGS.map((lang) => (
                    <option key={lang} value={lang}>
                        {LANG_LABELS[lang]}
                    </option>
                ))}
            </select>
        </div>
    )
}
