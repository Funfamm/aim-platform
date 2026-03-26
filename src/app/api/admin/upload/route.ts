import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

// Route segment config (App Router)
export const runtime = 'nodejs'
export const maxDuration = 60 // 60s timeout for large uploads

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']
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

        const ext = path.extname(file.name).toLowerCase() || '.png'
        const isImage = IMAGE_EXTS.includes(ext)
        const isVideo = VIDEO_EXTS.includes(ext)
        const isDoc = DOC_EXTS.includes(ext)

        if (!isImage && !isVideo && !isDoc) {
            return NextResponse.json({
                error: `Unsupported file type: ${ext}. Allowed: ${[...IMAGE_EXTS, ...VIDEO_EXTS, ...DOC_EXTS].join(', ')}`,
            }, { status: 400 })
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

        // Organize uploads by type
        const subDir = isVideo ? 'videos' : isDoc ? 'documents' : 'images'
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', subDir, category)
        await mkdir(uploadDir, { recursive: true })

        // Clean filename: timestamp + sanitized name
        const safeName = file.name
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/-+/g, '-')
            .toLowerCase()
        const fileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${safeName}`
        const filePath = path.join(uploadDir, fileName)

        await writeFile(filePath, buffer)

        const url = `/uploads/${subDir}/${category}/${fileName}`
        const fileType = isVideo ? 'video' : isDoc ? 'document' : 'image'
        return NextResponse.json({
            url,
            fileName,
            type: fileType,
            size: file.size,
            originalName: file.name,
        })
    } catch (error) {
        console.error('Upload error:', error)
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }
}
