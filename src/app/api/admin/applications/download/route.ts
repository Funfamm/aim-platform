import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'
import archiver from 'archiver'
import { createReadStream, existsSync } from 'fs'
import path from 'path'
import { PassThrough } from 'stream'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    try {
        const { applicationIds } = await req.json()

        if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
            return NextResponse.json({ error: 'No applications selected' }, { status: 400 })
        }

        // Fetch selected applications
        const applications = await prisma.application.findMany({
            where: { id: { in: applicationIds } },
            include: { castingCall: { include: { project: true } } },
        })

        if (applications.length === 0) {
            return NextResponse.json({ error: 'No applications found' }, { status: 404 })
        }

        // Buffer the ZIP in memory
        const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
            const archive = archiver('zip', { zlib: { level: 5 } })
            const chunks: Buffer[] = []
            const passThrough = new PassThrough()

            passThrough.on('data', (chunk: Buffer) => chunks.push(chunk))
            passThrough.on('end', () => resolve(Buffer.concat(chunks)))
            passThrough.on('error', reject)
            archive.on('error', reject)

            archive.pipe(passThrough)

            const uploadsDir = path.join(process.cwd(), 'public')

            for (const app of applications) {
                const safeName = app.fullName.replace(/[^a-zA-Z0-9\s-]/g, '').trim()
                const roleName = app.castingCall.roleName.replace(/[^a-zA-Z0-9\s-]/g, '').trim()
                const folderName = `${safeName} - ${roleName}`

                // Applicant info
                const info = [
                    `Name: ${app.fullName}`,
                    `Email: ${app.email}`,
                    `Phone: ${app.phone || 'N/A'}`,
                    `Age: ${app.age || 'N/A'}`,
                    `Gender: ${app.gender || 'N/A'}`,
                    `Location: ${app.location || 'N/A'}`,
                    `Role: ${app.castingCall.roleName} (${app.castingCall.roleType})`,
                    `Project: ${app.castingCall.project.title}`,
                    `Status: ${app.status}`,
                    `AI Score: ${app.aiScore ?? 'Not analyzed'}`,
                    `AI Fit: ${app.aiFitLevel || 'N/A'}`,
                    `Applied: ${new Date(app.createdAt).toLocaleDateString()}`,
                    '',
                    '--- About ---',
                    app.experience || 'N/A',
                    '',
                    '--- Special Skills ---',
                    app.specialSkills || 'N/A',
                ].join('\n')

                archive.append(info, { name: `${folderName}/applicant-info.txt` })

                // Photos
                if (app.headshotPath) {
                    try {
                        const photoPaths: string[] = JSON.parse(app.headshotPath)
                        for (const photoPath of photoPaths) {
                            // Strip leading slash — path.join treats absolute-looking paths as root on POSIX
                            const normalizedPath = photoPath.replace(/^\/+/, '')
                            const fullPath = path.join(uploadsDir, normalizedPath)
                            if (existsSync(fullPath)) {
                                archive.append(createReadStream(fullPath), { name: `${folderName}/photos/${path.basename(fullPath)}` })
                            } else {
                                console.warn(`[download] Photo not found: ${fullPath}`)
                            }
                        }
                    } catch {
                        const normalizedPath = app.headshotPath.replace(/^\/+/, '')
                        const fullPath = path.join(uploadsDir, normalizedPath)
                        if (existsSync(fullPath)) {
                            archive.append(createReadStream(fullPath), { name: `${folderName}/photos/${path.basename(fullPath)}` })
                        }
                    }
                }

                // Voice recording
                if (app.selfTapePath) {
                    const normalizedPath = app.selfTapePath.replace(/^\/+/, '')
                    const voicePath = path.join(uploadsDir, normalizedPath)
                    if (existsSync(voicePath)) {
                        archive.append(createReadStream(voicePath), { name: `${folderName}/voice/${path.basename(voicePath)}` })
                    } else {
                        console.warn(`[download] Voice not found: ${voicePath}`)
                    }
                }

                // AI report
                if (app.aiReport) {
                    const aiReport = [
                        'AI Casting Report',
                        '=================',
                        `Overall Score: ${app.aiScore}/100`,
                        `Role Fit: ${app.aiFitLevel || 'N/A'}`,
                        '',
                        app.aiReport,
                    ].join('\n')
                    archive.append(aiReport, { name: `${folderName}/ai-report.txt` })
                }
            }

            archive.finalize()
        })

        const timestamp = new Date().toISOString().slice(0, 10)
        return new Response(new Uint8Array(zipBuffer), {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="AIM_Applications_${timestamp}.zip"`,
                'Content-Length': String(zipBuffer.length),
            },
        })
    } catch (error) {
        console.error('ZIP download error:', error)
        return NextResponse.json({ error: 'Failed to create download' }, { status: 500 })
    }
}
