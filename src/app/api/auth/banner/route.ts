import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { withDbRetry } from '@/lib/db-retry'
import { uploadLimiter } from '@/lib/rate-limit'
import { uploadBufferToR2 } from '@/lib/r2Upload'
import { sanitizeFilename, validateFileType, validateFileSize, checkMagicBytes, IMAGE_TYPES, MAX_IMAGE_SIZE } from '@/lib/upload-safety'
import { logUploadEvent } from '@/lib/upload-audit'

export async function POST(request: NextRequest) {
    const blocked = uploadLimiter.check(request)
    if (blocked) return blocked

    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const formData = await request.formData()
        const file = formData.get('banner') as File | null

        if (!file || file.size === 0) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 })
        }

        // Validate type
        const typeCheck = validateFileType(file, IMAGE_TYPES)
        if (!typeCheck.valid) {
            logUploadEvent({
                action: 'upload_rejected', route: '/api/auth/banner',
                userId: session.userId as string, fileName: file.name, mimeType: file.type, fileSize: file.size,
                reason: typeCheck.error, code: 'MIME_REJECTED',
            })
            return NextResponse.json({ error: typeCheck.error }, { status: 400 })
        }

        // Validate size
        const sizeCheck = validateFileSize(file, MAX_IMAGE_SIZE)
        if (!sizeCheck.valid) {
            return NextResponse.json({ error: sizeCheck.error }, { status: 400 })
        }

        const safeFilename = sanitizeFilename(file.name)
        const r2Key = `banners/${session.userId}_${Date.now()}_${safeFilename}`

        const buffer = Buffer.from(await file.arrayBuffer())

        // ═══ MAGIC-BYTE VALIDATION ═══
        const magicCheck = checkMagicBytes(buffer, file.type)
        if (!magicCheck.valid) {
            logUploadEvent({
                action: 'upload_rejected', route: '/api/auth/banner',
                userId: session.userId as string, fileName: file.name, mimeType: file.type, fileSize: file.size,
                reason: magicCheck.error, code: 'MAGIC_BYTE_MISMATCH',
            })
            return NextResponse.json({
                error: `Invalid file content: ${magicCheck.error}`,
            }, { status: 400 })
        }

        let bannerUrl: string
        try {
            bannerUrl = await uploadBufferToR2(buffer, r2Key, file.type)
        } catch (err) {
            console.error('[uploadBufferToR2 Banner Error]', err)
            return NextResponse.json({ error: 'Failed to securely store banner image' }, { status: 500 })
        }

        logUploadEvent({
            action: 'upload_accepted', route: '/api/auth/banner',
            userId: session.userId as string, fileName: file.name, mimeType: file.type, fileSize: file.size,
        })

        await withDbRetry(() => prisma.user.update({
            where: { id: session.userId as string },
            data: { bannerUrl },
        }), 'banner_save_url')

        return NextResponse.json({ success: true, bannerUrl })
    } catch (error) {
        console.error('Banner upload error:', error)
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }
}

// DELETE — remove banner
export async function DELETE(request: NextRequest) {
    const blocked = uploadLimiter.check(request)
    if (blocked) return blocked

    const session = await getUserSession()
    if (!session?.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        await withDbRetry(() => prisma.user.update({
            where: { id: session.userId as string },
            data: { bannerUrl: null },
        }), 'banner_remove_url')
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Banner remove error:', error)
        return NextResponse.json({ error: 'Failed to remove banner' }, { status: 500 })
    }
}
