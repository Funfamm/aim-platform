/**
 * ComposeTab — Validation & Draft Logic Tests
 *
 * Tests the extracted pure-function logic from ComposeTab:
 *   - CTA URL validation
 *   - canSend gating
 *   - Draft serialization / deserialization
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Reproduce validation from ComposeTab ────────────────────────────────────

function ctaUrlValid(ctaUrl: string): boolean {
    return !ctaUrl.trim() || /^(\/|https:\/\/)/.test(ctaUrl.trim())
}

interface ComposeState {
    title: string
    message: string
    sending: boolean
    someAudienceSelected: boolean
    ctaUrlValid: boolean
}

function canSend(s: ComposeState): boolean {
    return !!(s.title.trim() && s.message.trim() && !s.sending && s.someAudienceSelected && s.ctaUrlValid)
}

// ── Reproduce draft logic from ComposeTab ───────────────────────────────────

const DRAFT_KEY = 'outreach_compose_draft'

interface DraftFields {
    title: string
    message: string
    bodyHtml: string
    imageUrl: string
    link: string
    outreachType: string
    ctaText: string
    ctaUrl: string
    ctaColor: string
    testEmail: string
}

function serializeDraft(fields: DraftFields): string {
    return JSON.stringify(fields)
}

function deserializeDraft(raw: string): DraftFields | null {
    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CTA URL VALIDATION (client-side)
// ═══════════════════════════════════════════════════════════════════════════
describe('ComposeTab CTA URL Validation', () => {
    it('should accept empty string (CTA is optional)', () => {
        expect(ctaUrlValid('')).toBe(true)
    })

    it('should accept whitespace-only (treated as empty)', () => {
        expect(ctaUrlValid('   ')).toBe(true)
    })

    it('should accept relative path', () => {
        expect(ctaUrlValid('/survey')).toBe(true)
    })

    it('should accept HTTPS URL', () => {
        expect(ctaUrlValid('https://example.com')).toBe(true)
    })

    it('should reject HTTP URL', () => {
        expect(ctaUrlValid('http://example.com')).toBe(false)
    })

    it('should reject javascript: URL', () => {
        expect(ctaUrlValid('javascript:alert(1)')).toBe(false)
    })

    it('should reject bare domain', () => {
        expect(ctaUrlValid('example.com')).toBe(false)
    })

    it('should accept URL with leading spaces (trimmed)', () => {
        expect(ctaUrlValid('  /survey  ')).toBe(true)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// canSend GATE
// ═══════════════════════════════════════════════════════════════════════════
describe('ComposeTab canSend Gate', () => {
    const base: ComposeState = {
        title: 'Test',
        message: 'Hello',
        sending: false,
        someAudienceSelected: true,
        ctaUrlValid: true,
    }

    it('should allow when all conditions met', () => {
        expect(canSend(base)).toBe(true)
    })

    it('should block when title is empty', () => {
        expect(canSend({ ...base, title: '' })).toBe(false)
    })

    it('should block when title is whitespace', () => {
        expect(canSend({ ...base, title: '   ' })).toBe(false)
    })

    it('should block when message is empty', () => {
        expect(canSend({ ...base, message: '' })).toBe(false)
    })

    it('should block when sending is true', () => {
        expect(canSend({ ...base, sending: true })).toBe(false)
    })

    it('should block when no audience selected', () => {
        expect(canSend({ ...base, someAudienceSelected: false })).toBe(false)
    })

    it('should block when CTA URL is invalid', () => {
        expect(canSend({ ...base, ctaUrlValid: false })).toBe(false)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// DRAFT SERIALIZATION
// ═══════════════════════════════════════════════════════════════════════════
describe('ComposeTab Draft Persistence', () => {
    const sampleDraft: DraftFields = {
        title: 'Season 2 Announcement',
        message: 'Casting is now open!',
        bodyHtml: '<p>Apply now</p>',
        imageUrl: '/images/banner.png',
        link: '/casting',
        outreachType: 'announcement',
        ctaText: '',
        ctaUrl: '',
        ctaColor: '#c9a84c',
        testEmail: 'admin@aim.studio',
    }

    it('should round-trip draft through JSON', () => {
        const json = serializeDraft(sampleDraft)
        const restored = deserializeDraft(json)
        expect(restored).toEqual(sampleDraft)
    })

    it('should return null for corrupted JSON', () => {
        expect(deserializeDraft('{invalid json')).toBeNull()
    })

    it('should return null for empty string', () => {
        expect(deserializeDraft('')).toBeNull()
    })

    it('should preserve all fields including empty strings', () => {
        const json = serializeDraft(sampleDraft)
        const restored = deserializeDraft(json)!
        expect(restored.ctaText).toBe('')
        expect(restored.ctaUrl).toBe('')
    })

    it('should preserve HTML in bodyHtml', () => {
        const draft: DraftFields = { ...sampleDraft, bodyHtml: '<h1>Bold</h1><p>Text</p>' }
        const restored = deserializeDraft(serializeDraft(draft))!
        expect(restored.bodyHtml).toBe('<h1>Bold</h1><p>Text</p>')
    })

    it('should use correct storage key', () => {
        expect(DRAFT_KEY).toBe('outreach_compose_draft')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// isDirty LOGIC
// ═══════════════════════════════════════════════════════════════════════════
describe('ComposeTab isDirty Logic', () => {
    function isDirty(fields: Partial<DraftFields>): boolean {
        return !!(fields.title?.trim() || fields.message?.trim() || fields.bodyHtml?.trim())
    }

    it('should be clean when all fields are empty', () => {
        expect(isDirty({ title: '', message: '', bodyHtml: '' })).toBe(false)
    })

    it('should be dirty when title has content', () => {
        expect(isDirty({ title: 'Test', message: '', bodyHtml: '' })).toBe(true)
    })

    it('should be dirty when message has content', () => {
        expect(isDirty({ title: '', message: 'Hello', bodyHtml: '' })).toBe(true)
    })

    it('should be dirty when bodyHtml has content', () => {
        expect(isDirty({ title: '', message: '', bodyHtml: '<p>X</p>' })).toBe(true)
    })

    it('should be clean when fields are whitespace only', () => {
        expect(isDirty({ title: '   ', message: '  ', bodyHtml: '  ' })).toBe(false)
    })
})
