import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'
import { generateProjectId } from '@/lib/projectRequestId'
import { requireAdmin } from '@/lib/auth'
import { sendEmail } from '@/lib/mailer'
import { projectRequestConfirmation, projectRequestAdminNotification } from '@/lib/project-request-emails'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

// ── Rate limiting (in-memory for Vercel — per-instance) ─────────────────────
const submissionRateMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5      // max submissions per IP per hour
const RATE_WINDOW = 3600000 // 1 hour

function isRateLimited(ip: string): boolean {
    const now = Date.now()
    const entry = submissionRateMap.get(ip)
    if (!entry || now > entry.resetAt) {
        submissionRateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
        return false
    }
    entry.count++
    return entry.count > RATE_LIMIT
}

// ── Valid enums ─────────────────────────────────────────────────────────────
const PROJECT_TYPES = ['birthday', 'brand', 'commercial', 'music', 'film', 'event', 'custom']
const VALID_STATUSES = ['received', 'reviewing', 'scope_confirmed', 'in_production', 'awaiting_client', 'delivered', 'completed', 'cancelled']

// ────────────────────────────────────────────────────────────────────────────
// POST — Public: Submit a new project request
// ────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
        if (isRateLimited(ip)) {
            return NextResponse.json({ error: 'Too many submissions. Please try again later.' }, { status: 429 })
        }

        const body = await req.json()

        // ── Server-side validation ──────────────────────────────────────────
        const errors: string[] = []

        if (!body.projectType || !PROJECT_TYPES.includes(body.projectType)) {
            errors.push('Invalid or missing project type')
        }
        if (!body.clientName || typeof body.clientName !== 'string' || body.clientName.trim().length < 2) {
            errors.push('Full name is required (min 2 characters)')
        }
        if (!body.email || typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
            errors.push('A valid email address is required')
        }
        if (!body.projectTitle || typeof body.projectTitle !== 'string' || body.projectTitle.trim().length < 2) {
            errors.push('Project title is required (min 2 characters)')
        }
        if (!body.description || typeof body.description !== 'string' || body.description.trim().length < 10) {
            errors.push('Please describe your project (min 10 characters)')
        }
        if (!body.consentContact) {
            errors.push('You must agree to be contacted about your project')
        }

        if (errors.length > 0) {
            return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 })
        }

        // ── Sanitize uploads array (audit fix #2 — max 10 files) ────────────
        let uploads = body.uploads
        if (Array.isArray(uploads)) {
            uploads = uploads.slice(0, 10).map((u: Record<string, unknown>) => ({
                key: String(u.key || ''),
                url: String(u.url || ''),
                name: String(u.name || ''),
                type: String(u.type || ''),
                size: Number(u.size || 0),
            }))
        } else {
            uploads = []
        }

        // ── Generate ID, access token, and save ────────────────────────────
        const projectId = await generateProjectId()
        const accessToken = randomBytes(32).toString('hex')

        const saved = await prisma.projectRequest.create({
            data: {
                id: projectId,
                accessToken,
                projectType: body.projectType,
                clientName: body.clientName.trim(),
                email: body.email.trim().toLowerCase(),
                phone: body.phone?.trim() || null,
                contactMethod: body.contactMethod || null,
                companyName: body.companyName?.trim() || null,
                projectTitle: body.projectTitle.trim(),
                description: body.description.trim(),
                deadline: body.deadline ? new Date(body.deadline) : null,
                audience: body.audience?.trim() || null,
                projectGoal: body.projectGoal?.trim() || null,
                tone: Array.isArray(body.tone) ? body.tone : null,
                visualStyle: body.visualStyle?.trim() || null,
                inspirationLinks: Array.isArray(body.inspirationLinks) ? body.inspirationLinks : null,
                avoidNotes: body.avoidNotes?.trim() || null,
                emotionalFeeling: body.emotionalFeeling?.trim() || null,
                budgetRange: body.budgetRange || null,
                budgetCurrency: body.budgetCurrency || 'USD',
                duration: body.duration?.trim() || null,
                aspectRatio: body.aspectRatio || null,
                deliveryPlatform: body.deliveryPlatform?.trim() || null,
                addOns: Array.isArray(body.addOns) ? body.addOns : null,
                rushDelivery: body.rushDelivery === true,
                customFields: body.customFields && typeof body.customFields === 'object' ? body.customFields : null,
                uploads: uploads.length > 0 ? uploads : null,
                consentUpload: body.consentUpload === true,
                consentContact: body.consentContact === true,
                language: body.language || 'en',
                userId: body.userId || null,
            },
        })

        // ── Send emails (Promise.allSettled — never blocks response) ─────
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://impactaistudio.com'
        const trackingUrl = `${siteUrl}/my-projects?id=${saved.id}&token=${accessToken}`

        const emailPromises: Promise<boolean>[] = []

        // 1. Client confirmation
        emailPromises.push(
            sendEmail({
                to: saved.email,
                subject: `🎬 Project Received: ${saved.projectTitle} — ID: ${saved.id}`,
                html: projectRequestConfirmation(
                    saved.clientName,
                    saved.id,
                    saved.projectTitle,
                    saved.projectType,
                    trackingUrl,
                ),
            })
        )

        // 2. Admin notification
        try {
            const settings = await prisma.siteSettings.findFirst({
                select: { notifyEmail: true, contactEmail: true },
            })
            const adminEmail = settings?.notifyEmail || settings?.contactEmail
            if (adminEmail) {
                emailPromises.push(
                    sendEmail({
                        to: adminEmail,
                        subject: `📋 New Project: ${saved.projectTitle} from ${saved.clientName}`,
                        html: projectRequestAdminNotification(
                            saved.clientName,
                            saved.email,
                            saved.id,
                            saved.projectTitle,
                            saved.projectType,
                            saved.budgetRange,
                            saved.deadline?.toLocaleDateString() || null,
                            saved.rushDelivery,
                            siteUrl,
                        ),
                        replyTo: saved.email,
                    })
                )
            }
        } catch (err) {
            logger.warn('project-requests', 'Failed to resolve admin email for notification', { error: err as Error })
        }

        // Fire all — never fail the submission
        Promise.allSettled(emailPromises).then(results => {
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    logger.error('project-requests', `Email ${i} failed`, { error: r.reason })
                }
            })
        })

        return NextResponse.json({
            success: true,
            project: {
                id: saved.id,
                projectTitle: saved.projectTitle,
                projectType: saved.projectType,
                status: saved.status,
                createdAt: saved.createdAt.toISOString(),
                accessToken,
            },
        })
    } catch (error) {
        console.error('[project-requests] Submit error:', error)
        return NextResponse.json({ error: 'Failed to submit project request' }, { status: 500 })
    }
}

// ────────────────────────────────────────────────────────────────────────────
// GET — Admin only: List all project requests with filters
// ────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
    try {
        await requireAdmin()
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const url = new URL(req.url)
        const status = url.searchParams.get('status')
        const type = url.searchParams.get('type')
        const urgent = url.searchParams.get('urgent')
        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)))

        const where: Record<string, unknown> = {}
        if (status && VALID_STATUSES.includes(status)) where.status = status
        if (type && PROJECT_TYPES.includes(type)) where.projectType = type
        if (urgent === 'true') where.urgent = true

        const [requests, total] = await Promise.all([
            prisma.projectRequest.findMany({
                where,
                orderBy: [{ urgent: 'desc' }, { createdAt: 'desc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.projectRequest.count({ where }),
        ])

        return NextResponse.json({
            requests: requests.map(r => ({
                ...r,
                createdAt: r.createdAt.toISOString(),
                updatedAt: r.updatedAt.toISOString(),
                deadline: r.deadline?.toISOString() || null,
            })),
            total,
            page,
            pages: Math.ceil(total / limit),
        })
    } catch (error) {
        console.error('[project-requests] List error:', error)
        return NextResponse.json({ error: 'Failed to list requests' }, { status: 500 })
    }
}
