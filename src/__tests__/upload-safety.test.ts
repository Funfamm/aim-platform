/**
 * Upload Safety — Test Suite
 * Tests magic-byte validation, URL sanitisation, and path-traversal guard.
 */

import { checkMagicBytes, sanitizeUrl, guardPathTraversal, validateUpload, validateFileType, validateFileSize, IMAGE_TYPES, AUDIO_TYPES } from '@/lib/upload-safety'

// ═══════════════════════════════════════════════════════════════
//  MAGIC-BYTE TESTS
// ═══════════════════════════════════════════════════════════════

describe('checkMagicBytes', () => {
    it('accepts a valid JPEG (FF D8 FF)', () => {
        const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46])
        const result = checkMagicBytes(buf, 'image/jpeg')
        expect(result.valid).toBe(true)
    })

    it('rejects an EXE disguised as JPEG', () => {
        // MZ header = Windows PE executable
        const buf = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])
        const result = checkMagicBytes(buf, 'image/jpeg')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('does not match')
    })

    it('accepts a valid PNG', () => {
        const buf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00])
        const result = checkMagicBytes(buf, 'image/png')
        expect(result.valid).toBe(true)
    })

    it('rejects a ZIP claiming to be PNG', () => {
        // PK header = ZIP archive
        const buf = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00])
        const result = checkMagicBytes(buf, 'image/png')
        expect(result.valid).toBe(false)
    })

    it('accepts a valid GIF', () => {
        const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
        const result = checkMagicBytes(buf, 'image/gif')
        expect(result.valid).toBe(true)
    })

    it('accepts a valid WebP', () => {
        // RIFF....WEBP
        const buf = Buffer.from([
            0x52, 0x49, 0x46, 0x46,  // RIFF
            0x00, 0x00, 0x00, 0x00,  // file size (placeholder)
            0x57, 0x45, 0x42, 0x50,  // WEBP
        ])
        const result = checkMagicBytes(buf, 'image/webp')
        expect(result.valid).toBe(true)
    })

    it('rejects RIFF file that is not WebP (e.g. AVI)', () => {
        const buf = Buffer.from([
            0x52, 0x49, 0x46, 0x46,
            0x00, 0x00, 0x00, 0x00,
            0x41, 0x56, 0x49, 0x20,  // AVI instead of WEBP
        ])
        const result = checkMagicBytes(buf, 'image/webp')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('not a WebP')
    })

    it('accepts a valid MP3 with ID3 header', () => {
        const buf = Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00])
        const result = checkMagicBytes(buf, 'audio/mpeg')
        expect(result.valid).toBe(true)
    })

    it('accepts a valid MP3 with sync header (FF FB)', () => {
        const buf = Buffer.from([0xFF, 0xFB, 0x90, 0x00, 0x00, 0x00])
        const result = checkMagicBytes(buf, 'audio/mpeg')
        expect(result.valid).toBe(true)
    })

    it('accepts a valid WAV (RIFF...WAVE)', () => {
        const buf = Buffer.from([
            0x52, 0x49, 0x46, 0x46,
            0x00, 0x00, 0x00, 0x00,
            0x57, 0x41, 0x56, 0x45,
        ])
        const result = checkMagicBytes(buf, 'audio/wav')
        expect(result.valid).toBe(true)
    })

    it('rejects RIFF file that is not WAV', () => {
        const buf = Buffer.from([
            0x52, 0x49, 0x46, 0x46,
            0x00, 0x00, 0x00, 0x00,
            0x41, 0x56, 0x49, 0x20,  // AVI
        ])
        const result = checkMagicBytes(buf, 'audio/wav')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('not a WAV')
    })

    it('accepts a valid OGG (OggS)', () => {
        const buf = Buffer.from([0x4F, 0x67, 0x67, 0x53, 0x00, 0x02])
        const result = checkMagicBytes(buf, 'audio/ogg')
        expect(result.valid).toBe(true)
    })

    it('accepts a valid MP4/M4A (ftyp box)', () => {
        const buf = Buffer.from([
            0x00, 0x00, 0x00, 0x20,  // box size
            0x66, 0x74, 0x79, 0x70,  // ftyp
            0x69, 0x73, 0x6F, 0x6D,  // isom
        ])
        const result = checkMagicBytes(buf, 'audio/mp4')
        expect(result.valid).toBe(true)
    })

    it('accepts audio/x-m4a with ftyp box', () => {
        const buf = Buffer.from([
            0x00, 0x00, 0x00, 0x1C,
            0x66, 0x74, 0x79, 0x70,
            0x4D, 0x34, 0x41, 0x20,  // M4A
        ])
        const result = checkMagicBytes(buf, 'audio/x-m4a')
        expect(result.valid).toBe(true)
    })

    it('accepts a valid WebM (EBML header)', () => {
        const buf = Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0x93, 0x42, 0x82, 0x88])
        const result = checkMagicBytes(buf, 'audio/webm')
        expect(result.valid).toBe(true)
    })

    it('accepts a valid PDF', () => {
        const buf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E])
        const result = checkMagicBytes(buf, 'application/pdf')
        expect(result.valid).toBe(true)
    })

    it('rejects an empty buffer', () => {
        const buf = Buffer.alloc(0)
        const result = checkMagicBytes(buf, 'image/jpeg')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('empty')
    })

    it('rejects unknown MIME types by default', () => {
        const buf = Buffer.from([0x00, 0x01, 0x02, 0x03])
        const result = checkMagicBytes(buf, 'application/x-custom')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('No known file signature')
    })

    it('allows unknown MIME types when allowUnknown is true', () => {
        const buf = Buffer.from([0x00, 0x01, 0x02, 0x03])
        const result = checkMagicBytes(buf, 'application/x-custom', { allowUnknown: true })
        expect(result.valid).toBe(true)
    })
})


// ═══════════════════════════════════════════════════════════════
//  URL SANITISATION TESTS
// ═══════════════════════════════════════════════════════════════

describe('sanitizeUrl', () => {
    it('accepts https:// URLs', () => {
        const result = sanitizeUrl('https://example.com/img.jpg')
        expect(result.valid).toBe(true)
        expect(result.sanitized).toBe('https://example.com/img.jpg')
    })

    it('accepts http:// URLs', () => {
        const result = sanitizeUrl('http://example.com/img.jpg')
        expect(result.valid).toBe(true)
    })

    it('accepts relative paths starting with /', () => {
        const result = sanitizeUrl('/uploads/photo.jpg')
        expect(result.valid).toBe(true)
        expect(result.sanitized).toBe('/uploads/photo.jpg')
    })

    it('accepts empty string', () => {
        const result = sanitizeUrl('')
        expect(result.valid).toBe(true)
        expect(result.sanitized).toBe('')
    })

    it('rejects javascript: scheme', () => {
        const result = sanitizeUrl('javascript:alert(1)')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('Dangerous URL scheme')
    })

    it('rejects JavaScript: scheme (case-insensitive)', () => {
        const result = sanitizeUrl('JaVaScRiPt:alert(document.cookie)')
        expect(result.valid).toBe(false)
    })

    it('rejects data: scheme', () => {
        const result = sanitizeUrl('data:text/html,<script>alert(1)</script>')
        expect(result.valid).toBe(false)
    })

    it('rejects blob: scheme', () => {
        const result = sanitizeUrl('blob:http://evil.com/abc')
        expect(result.valid).toBe(false)
    })

    it('rejects file: scheme', () => {
        const result = sanitizeUrl('file:///etc/passwd')
        expect(result.valid).toBe(false)
    })

    it('rejects vbscript: scheme', () => {
        const result = sanitizeUrl('vbscript:msgbox("xss")')
        expect(result.valid).toBe(false)
    })

    it('rejects bare domain (no scheme)', () => {
        const result = sanitizeUrl('example.com/img.jpg')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('must start with')
    })

    it('rejects URLs longer than 2000 characters', () => {
        const result = sanitizeUrl('https://example.com/' + 'a'.repeat(2000))
        expect(result.valid).toBe(false)
        expect(result.error).toContain('too long')
    })
})


// ═══════════════════════════════════════════════════════════════
//  PATH TRAVERSAL GUARD TESTS
// ═══════════════════════════════════════════════════════════════

describe('guardPathTraversal', () => {
    it('allows paths inside the upload directory', () => {
        const uploadDir = '/app/public/uploads/images'
        const filePath = '/app/public/uploads/images/photo.jpg'
        expect(() => guardPathTraversal(filePath, uploadDir)).not.toThrow()
    })

    it('blocks path traversal via ../', () => {
        const uploadDir = '/app/public/uploads/images'
        const filePath = '/app/public/uploads/images/../../etc/passwd'
        expect(() => guardPathTraversal(filePath, uploadDir)).toThrow('Path traversal blocked')
    })

    it('returns the resolved path on success', () => {
        const uploadDir = '/app/public/uploads'
        const filePath = '/app/public/uploads/test.jpg'
        const result = guardPathTraversal(filePath, uploadDir)
        expect(result).toBeTruthy()
    })
})
