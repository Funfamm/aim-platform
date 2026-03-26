import { NextRequest, NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { uploadLimiter } from '@/lib/rate-limit'
import { sanitizeFilename, validateFileType, validateFileSize, IMAGE_TYPES, MAX_IMAGE_SIZE } from '@/lib/upload-safety'

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
            return NextResponse.json({ error: typeCheck.error }, { status: 400 })
        }

        // Validate size
        const sizeCheck = validateFileSize(file, MAX_IMAGE_SIZE)
        if (!sizeCheck.valid) {
            return NextResponse.json({ error: sizeCheck.error }, { status: 400 })
        }

        // Save with sanitized filename
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'banners')
        await mkdir(uploadDir, { recursive: true })

        const safeFilename = sanitizeFilename(file.name)
        const filePath = path.join(uploadDir, safeFilename)

        // Prevent path traversal — ensure resolved path is inside upload dir  
        const resolvedPath = path.resolve(filePath)
        if (!resolvedPath.startsWith(path.resolve(uploadDir))) {
            return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        await writeFile(resolvedPath, buffer)

        const bannerUrl = `/uploads/banners/${safeFilename}`

        await prisma.user.update({
            where: { id: session.userId as string },
            data: { bannerUrl },
        })

        return NextResponse.json({ success: true, bannerUrl })
    } catch (error) {
        console.error('Banner upload error:', error)
        return NextResponse.json({ error: 'Upload failed: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 })
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
        await prisma.user.update({
            where: { id: session.userId as string },
            data: { bannerUrl: null },
        })
        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Banner remove error:', error)
        return NextResponse.json({ error: 'Failed to remove banner' }, { status: 500 })
    }
}
