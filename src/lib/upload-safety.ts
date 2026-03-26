import path from 'path'
import crypto from 'crypto'

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

/** Common image MIME types */
export const IMAGE_TYPES = [
    'image/jpeg', 'image/png', 'image/webp', 'image/gif'
]

/** Common video MIME types */
export const VIDEO_TYPES = [
    'video/mp4', 'video/webm', 'video/quicktime'
]

/** Common document MIME types */
export const DOCUMENT_TYPES = [
    'application/pdf'
]

/** 5 MB in bytes */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024

/** 100 MB in bytes */
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024

/** 10 MB in bytes */
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024
