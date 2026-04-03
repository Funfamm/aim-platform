import path from 'path'
import crypto from 'crypto'

// ═══════════════════════════════════════════════════════════════
//  UPLOAD SAFETY — Defence-in-depth file upload validation
// ═══════════════════════════════════════════════════════════════

/**
 * Sanitize an uploaded filename to prevent path traversal and special character issues.
 * Returns a safe filename with a random prefix to avoid collisions.
 */
export function sanitizeFilename(original: string): string {
    // Extract extension safely
    const ext = path.extname(original).toLowerCase().replace(/[^a-z0-9.]/g, '')
    
    // Generate a unique prefix
    const prefix = crypto.randomBytes(8).toString('hex')
    const timestamp = Date.now()
    
    // Clean the base name: remove path separators, special chars
    let base = path.basename(original, path.extname(original))
    base = base
        .replace(/[^a-zA-Z0-9_-]/g, '_')  // Only allow safe chars
        .replace(/_+/g, '_')               // Collapse multiple underscores
        .slice(0, 50)                       // Limit length

    return `${prefix}_${timestamp}_${base}${ext}`
}

/**
 * Validate uploaded file type against an allowlist.
 */
export function validateFileType(
    file: File,
    allowedTypes: string[]
): { valid: boolean; error?: string } {
    const mime = file.type.toLowerCase()
    
    if (!allowedTypes.includes(mime)) {
        return {
            valid: false,
            error: `File type "${mime}" is not allowed. Accepted: ${allowedTypes.join(', ')}`
        }
    }
    
    return { valid: true }
}

/**
 * Validate file size.
 */
export function validateFileSize(
    file: File,
    maxSizeBytes: number
): { valid: boolean; error?: string } {
    if (file.size > maxSizeBytes) {
        const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(1)
        const fileMB = (file.size / (1024 * 1024)).toFixed(1)
        return {
            valid: false,
            error: `File too large (${fileMB}MB). Maximum allowed: ${maxMB}MB`
        }
    }
    
    if (file.size === 0) {
        return { valid: false, error: 'File is empty' }
    }
    
    return { valid: true }
}

// ═══════════════════════════════════════════════════════════════
//  MAGIC-BYTE (FILE SIGNATURE) VALIDATION
// ═══════════════════════════════════════════════════════════════

/**
 * Known-good file signatures mapped by MIME type.
 * Each entry has an array of possible signatures (some formats have multiple valid headers).
 */
const MAGIC_SIGNATURES: Record<string, Array<{ bytes: number[]; offset: number }>> = {
    // ── Images ──
    'image/jpeg': [
        { bytes: [0xFF, 0xD8, 0xFF], offset: 0 },
    ],
    'image/png': [
        { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], offset: 0 },
    ],
    'image/webp': [
        // RIFF....WEBP  (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
        { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
    ],
    'image/gif': [
        { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0 },   // GIF8 (covers GIF87a and GIF89a)
    ],
    'image/heic': [
        { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },   // ftyp box (ISO BMFF container)
    ],
    'image/heif': [
        { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },   // ftyp box (ISO BMFF container)
    ],

    // ── Audio ──
    'audio/mpeg': [
        { bytes: [0x49, 0x44, 0x33], offset: 0 },          // ID3 tag
        { bytes: [0xFF, 0xFB], offset: 0 },                 // MPEG sync (Layer 3)
        { bytes: [0xFF, 0xF3], offset: 0 },                 // MPEG sync (Layer 3, lower bitrate)
        { bytes: [0xFF, 0xF2], offset: 0 },                 // MPEG sync (Layer 3, free bitrate)
    ],
    'audio/mp3': [
        { bytes: [0x49, 0x44, 0x33], offset: 0 },
        { bytes: [0xFF, 0xFB], offset: 0 },
        { bytes: [0xFF, 0xF3], offset: 0 },
        { bytes: [0xFF, 0xF2], offset: 0 },
    ],
    'audio/wav': [
        // RIFF....WAVE
        { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
    ],
    'audio/ogg': [
        { bytes: [0x4F, 0x67, 0x67, 0x53], offset: 0 },   // OggS
    ],
    'audio/webm': [
        { bytes: [0x1A, 0x45, 0xDF, 0xA3], offset: 0 },   // EBML (WebM container)
    ],
    'audio/mp4': [
        // ftyp box at offset 4
        { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
    ],
    'audio/x-m4a': [
        { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },
    ],

    // ── Video (admin only) ──
    'video/mp4': [
        { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },   // ftyp box
    ],
    'video/webm': [
        { bytes: [0x1A, 0x45, 0xDF, 0xA3], offset: 0 },   // EBML
    ],
    'video/quicktime': [
        { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 },   // ftyp box (MOV)
    ],

    // ── Documents (admin only) ──
    'application/pdf': [
        { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0 },   // %PDF
    ],
}

/**
 * Validate that the actual bytes of a file match the expected MIME type.
 * Returns { valid: true } if the magic bytes match, or { valid: false, error } if they don't.
 * 
 * Files with no known signature entry are rejected by default (fail-closed).
 * Pass `allowUnknown: true` to skip validation for types not in the signature table.
 */
export function checkMagicBytes(
    buffer: Buffer,
    expectedMime: string,
    options?: { allowUnknown?: boolean }
): { valid: boolean; error?: string } {
    if (buffer.length === 0) {
        return { valid: false, error: 'File is empty (0 bytes)' }
    }

    const signatures = MAGIC_SIGNATURES[expectedMime.toLowerCase()]

    // If we have no signature entry for this MIME type
    if (!signatures) {
        if (options?.allowUnknown) {
            return { valid: true }
        }
        return { valid: false, error: `No known file signature for type "${expectedMime}". Upload rejected.` }
    }

    // Check if the buffer matches ANY of the known signatures for this type
    const matches = signatures.some(sig => {
        if (buffer.length < sig.offset + sig.bytes.length) return false
        return sig.bytes.every((byte, i) => buffer[sig.offset + i] === byte)
    })

    if (!matches) {
        return {
            valid: false,
            error: `File content does not match expected type "${expectedMime}". The file may be corrupted or disguised.`
        }
    }

    // Extra check for WebP: bytes 8-11 must be "WEBP"
    if (expectedMime === 'image/webp') {
        if (buffer.length < 12) {
            return { valid: false, error: 'File too small to be a valid WebP image.' }
        }
        const webpMark = buffer.slice(8, 12).toString('ascii')
        if (webpMark !== 'WEBP') {
            return { valid: false, error: 'File has RIFF header but is not a WebP image.' }
        }
    }

    // Extra check for WAV: bytes 8-11 must be "WAVE"
    if (expectedMime === 'audio/wav') {
        if (buffer.length < 12) {
            return { valid: false, error: 'File too small to be a valid WAV file.' }
        }
        const waveMark = buffer.slice(8, 12).toString('ascii')
        if (waveMark !== 'WAVE') {
            return { valid: false, error: 'File has RIFF header but is not a WAV audio file.' }
        }
    }

    return { valid: true }
}

// ═══════════════════════════════════════════════════════════════
//  PATH TRAVERSAL GUARD
// ═══════════════════════════════════════════════════════════════

/**
 * Checks that the resolved file path is inside the expected upload directory.
 * Returns the resolved path on success; throws a descriptive error on failure.
 */
export function guardPathTraversal(filePath: string, uploadDir: string): string {
    const resolvedPath = path.resolve(filePath)
    const resolvedDir = path.resolve(uploadDir)
    if (!resolvedPath.startsWith(resolvedDir + path.sep) && resolvedPath !== resolvedDir) {
        throw new Error(`Path traversal blocked: "${filePath}" resolves outside "${uploadDir}"`)
    }
    return resolvedPath
}

// ═══════════════════════════════════════════════════════════════
//  URL SANITISATION (paste-URL input)
// ═══════════════════════════════════════════════════════════════

const DANGEROUS_SCHEMES = ['javascript:', 'data:', 'blob:', 'file:', 'vbscript:']
const MAX_URL_LENGTH = 2000

/**
 * Validates a URL pasted by the user in the FileUploader component.
 * Only allows `https://`, `http://`, or relative paths starting with `/`.
 */
export function sanitizeUrl(
    url: string
): { valid: boolean; sanitized: string; error?: string } {
    const trimmed = url.trim()

    if (!trimmed) {
        return { valid: true, sanitized: '' }
    }

    if (trimmed.length > MAX_URL_LENGTH) {
        return { valid: false, sanitized: '', error: `URL too long (max ${MAX_URL_LENGTH} characters)` }
    }

    // Check for dangerous schemes (case-insensitive)
    const lower = trimmed.toLowerCase()
    for (const scheme of DANGEROUS_SCHEMES) {
        if (lower.startsWith(scheme)) {
            return { valid: false, sanitized: '', error: `Dangerous URL scheme "${scheme}" is not allowed.` }
        }
    }

    // Must be https://, http://, or a relative path starting with /
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('/')) {
        return { valid: true, sanitized: trimmed }
    }

    return {
        valid: false,
        sanitized: '',
        error: 'URL must start with https://, http://, or / (relative path).'
    }
}


// ═══════════════════════════════════════════════════════════════
//  COMBINED VALIDATION HELPER
// ═══════════════════════════════════════════════════════════════

/**
 * All-in-one upload validator. Performs MIME check, size check, and magic-byte check.
 * Returns { valid: true } or { valid: false, error, code } with a machine-readable code.
 */
export function validateUpload(
    file: File,
    buffer: Buffer,
    allowedTypes: string[],
    maxSizeBytes: number,
): { valid: boolean; error?: string; code?: string } {
    // 1. File size
    const sizeResult = validateFileSize(file, maxSizeBytes)
    if (!sizeResult.valid) {
        return { valid: false, error: sizeResult.error, code: 'SIZE_LIMIT' }
    }

    // 2. MIME type allowlist
    const typeResult = validateFileType(file, allowedTypes)
    if (!typeResult.valid) {
        return { valid: false, error: typeResult.error, code: 'MIME_REJECTED' }
    }

    // 3. Magic-byte validation
    const magicResult = checkMagicBytes(buffer, file.type)
    if (!magicResult.valid) {
        return { valid: false, error: magicResult.error, code: 'MAGIC_BYTE_MISMATCH' }
    }

    return { valid: true }
}


// ═══════════════════════════════════════════════════════════════
//  TYPE CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** Common image MIME types (NO SVG — XSS risk) */
export const IMAGE_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif'
]

/** Common audio MIME types */
export const AUDIO_TYPES = [
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/x-m4a', 'audio/mp3'
]

/** Common audio file extensions */
export const AUDIO_EXTENSIONS = ['.mp3', '.mp4', '.m4a', '.wav', '.webm', '.ogg']

/** Video MIME types — admin use only */
export const ADMIN_VIDEO_TYPES = [
    'video/mp4', 'video/webm', 'video/quicktime'
]

/** Common document MIME types */
export const DOCUMENT_TYPES = [
    'application/pdf'
]

// ── Size limits ──
/** 5 MB in bytes */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024

/** 25 MB in bytes */
export const MAX_AUDIO_SIZE = 25 * 1024 * 1024

/** 100 MB in bytes */
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024

/** 10 MB in bytes */
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
