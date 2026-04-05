import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { checkMagicBytes } from '@/lib/upload-safety'
import { logUploadEvent } from '@/lib/upload-audit'
import { uploadBufferToR2 } from '@/lib/r2Upload'

// Route segment config (App Router)
export const runtime = 'nodejs'
export const maxDuration = 60 // 60s timeout for large uploads

// ═══ ALLOWLISTS — NO SVG (XSS risk) ═══
const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.avi']
const DOC_EXTS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.md', '.rtf', '.xls', '.xlsx', '.csv']
const MAX_IMAGE_SIZE = 10 * 1024 * 1024   // 10MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024  // 500MB
const MAX_DOC_SIZE = 50 * 1024 * 1024     // 50MB

export async function POST(req: NextRequest) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        const category = (formData.get('category') as string) || 'general'

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        const fileName = file.name
        const extMatch = fileName.match(/\.[0-9a-z]+$/i)
        const ext = extMatch ? extMatch[0].toLowerCase() : '.png'
        
        const isImage = IMAGE_EXTS.includes(ext)
        const isVideo = VIDEO_EXTS.includes(ext)
        const isDoc = DOC_EXTS.includes(ext)

        if (!isImage && !isVideo && !isDoc) {
            logUploadEvent({
                action: 'upload_rejected', route: '/api/admin/upload',
                fileName: file.name, mimeType: file.type, fileSize: file.size,
                reason: `Unsupported extension: ${ext}`, code: 'EXT_REJECTED',
            })
            return NextResponse.json({
                error: `Unsupported file type: ${ext}. Allowed: ${[...IMAGE_EXTS, ...VIDEO_EXTS, ...DOC_EXTS].join(', ')}`,
            }, { status: 400 })
        }

        // ═══ MIME TYPE VALIDATION ═══
        const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        const ALLOWED_VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
        const ALLOWED_DOC_MIMES = [
            'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain', 'text/markdown', 'application/rtf',
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv',
        ]

        if (file.type) {
            if (isImage && !ALLOWED_IMAGE_MIMES.includes(file.type)) {
                logUploadEvent({
                    action: 'upload_rejected', route: '/api/admin/upload',
                    fileName: file.name, mimeType: file.type, fileSize: file.size,
                    reason: `MIME mismatch: ${file.type} with ext ${ext}`, code: 'MIME_REJECTED',
                })
                return NextResponse.json({ error: `MIME type mismatch: file claims to be ${file.type} but has image extension ${ext}.` }, { status: 400 })
            }
            if (isVideo && !ALLOWED_VIDEO_MIMES.includes(file.type)) {
                logUploadEvent({
                    action: 'upload_rejected', route: '/api/admin/upload',
                    fileName: file.name, mimeType: file.type, fileSize: file.size,
                    reason: `MIME mismatch: ${file.type} with ext ${ext}`, code: 'MIME_REJECTED',
                })
                return NextResponse.json({ error: `MIME type mismatch: file claims to be ${file.type} but has video extension ${ext}.` }, { status: 400 })
            }
            if (isDoc && !ALLOWED_DOC_MIMES.includes(file.type)) {
                logUploadEvent({
                    action: 'upload_rejected', route: '/api/admin/upload',
                    fileName: file.name, mimeType: file.type, fileSize: file.size,
                    reason: `MIME mismatch: ${file.type} with ext ${ext}`, code: 'MIME_REJECTED',
                })
                return NextResponse.json({ error: `MIME type mismatch: file claims to be ${file.type} but has document extension ${ext}.` }, { status: 400 })
            }
        }

        // Size checks
        if (isImage && file.size > MAX_IMAGE_SIZE) {
            return NextResponse.json({ error: 'Image too large. Maximum 10MB.' }, { status: 400 })
        }
        if (isVideo && file.size > MAX_VIDEO_SIZE) {
            return NextResponse.json({ error: 'Video too large. Maximum 500MB.' }, { status: 400 })
        }
        if (isDoc && file.size > MAX_DOC_SIZE) {
            return NextResponse.json({ error: 'Document too large. Maximum 50MB.' }, { status: 400 })
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // ═══ MAGIC-BYTE VALIDATION ═══
        // For images and videos, check that actual file content matches the declared type.
        // Documents (DOCX, PPTX, etc.) are ZIP-based and have many valid headers, so we
        // only enforce magic checks for types with well-known signatures.
        if (file.type && (isImage || isVideo || file.type === 'application/pdf')) {
            const magicCheck = checkMagicBytes(buffer, file.type)
            if (!magicCheck.valid) {
                logUploadEvent({
                    action: 'upload_rejected', route: '/api/admin/upload',
                    fileName: file.name, mimeType: file.type, fileSize: file.size,
                    reason: magicCheck.error, code: 'MAGIC_BYTE_MISMATCH',
                })
                return NextResponse.json({
                    error: `Invalid file content: ${magicCheck.error}`,
                }, { status: 400 })
            }
        }

        // Organize uploads by type
        const subDir = isVideo ? 'videos' : isDoc ? 'documents' : 'images'

        // Clean filename: timestamp + sanitized name
        const safeName = file.name
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/-+/g, '-')
            .toLowerCase()
        
        const generatedFileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`
        const r2Key = `uploads/${subDir}/${category}/${generatedFileName}`

        // ═══ CLOUDFLARE R2 UPLOAD ═══
        let url: string
        try {
            url = await uploadBufferToR2(buffer, r2Key, file.type || 'application/octet-stream')
        } catch (err) {
            console.error('[uploadBufferToR2 Admin Error]', err)
            return NextResponse.json({ error: 'Failed to securely store file' }, { status: 500 })
        }

        const fileType = isVideo ? 'video' : isDoc ? 'document' : 'image'

        logUploadEvent({
            action: 'upload_accepted', route: '/api/admin/upload',
            fileName: file.name, mimeType: file.type, fileSize: file.size,
        })

        return NextResponse.json({
            url,
            fileName: generatedFileName,
            type: fileType,
            size: file.size,
            originalName: file.name,
        })
    } catch (error) {
        console.error('Upload error:', error)
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }
}
