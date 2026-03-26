import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET all materials for a module
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { id: courseId } = await params
    const url = new URL(req.url)
    const moduleId = url.searchParams.get('moduleId')

    try {
        const where: any = moduleId
            ? { moduleId }
            : {
                module: { courseId },
            }

        const materials = await (prisma as any).learningMaterial.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        })

        return NextResponse.json(materials)
    } catch (err) {
        return NextResponse.json({ error: 'Failed to fetch materials', details: String(err) }, { status: 500 })
    }
}

// POST: Add a new material to a module
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    await params // consume params
    const body = await req.json()

    if (!body.moduleId || !body.fileName || !body.filePath) {
        return NextResponse.json({ error: 'moduleId, fileName, and filePath are required' }, { status: 400 })
    }

    try {
        const material = await (prisma as any).learningMaterial.create({
            data: {
                moduleId: body.moduleId,
                fileName: body.fileName,
                fileType: body.fileType || 'document',
                filePath: body.filePath,
                fileSize: body.fileSize || null,
                metadata: body.metadata ? JSON.stringify(body.metadata) : null,
            },
        })

        return NextResponse.json(material, { status: 201 })
    } catch (err) {
        return NextResponse.json({ error: 'Failed to create material', details: String(err) }, { status: 500 })
    }
}

// DELETE: Remove a material
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    await params
    const url = new URL(req.url)
    const materialId = url.searchParams.get('materialId')

    if (!materialId) {
        return NextResponse.json({ error: 'materialId is required' }, { status: 400 })
    }

    try {
        await (prisma as any).learningMaterial.delete({
            where: { id: materialId },
        })
        return NextResponse.json({ ok: true })
    } catch (err) {
        return NextResponse.json({ error: 'Failed to delete material', details: String(err) }, { status: 500 })
    }
}
