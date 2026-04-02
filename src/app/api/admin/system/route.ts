import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const startTime = performance.now()

    try {
        // ── Database health check ──
        const dbStart = performance.now()
        await prisma.$queryRaw`SELECT 1`
        const dbLatency = Math.round(performance.now() - dbStart)

        // ── Table row counts (lightweight) ──
        const [
            users, projects, castingCalls, applications, donations,
            subscribers, pageViews, filmViews, enrollments, courses,
            notifications,
        ] = await Promise.all([
            prisma.user.count(),
            prisma.project.count(),
            prisma.castingCall.count(),
            prisma.application.count(),
            prisma.donation.count(),
            prisma.subscriber.count(),
            prisma.pageView.count(),
            prisma.filmView.count(),
            prisma.enrollment.count(),
            prisma.course.count(),
            prisma.notification.count(),
        ])

        // ── Storage estimates ──
        const totalRecords = users + projects + castingCalls + applications + donations + subscribers + pageViews + filmViews + enrollments + courses + notifications

        // ── 24h activity pulse ──
        const now = new Date()
        const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const h1 = new Date(now.getTime() - 60 * 60 * 1000)

        const [views24h, users24h, apps24h, views1h] = await Promise.all([
            prisma.pageView.count({ where: { createdAt: { gte: h24 } } }),
            prisma.user.count({ where: { createdAt: { gte: h24 } } }),
            prisma.application.count({ where: { createdAt: { gte: h24 } } }),
            prisma.pageView.count({ where: { createdAt: { gte: h1 } } }),
        ])

        // ── Memory snapshot (Node.js process) ──
        const mem = process.memoryUsage()

        // ── Environment info ──
        const environment = process.env.NODE_ENV || 'development'
        const region = process.env.RENDER_REGION || process.env.VERCEL_REGION || 'local'
        const platform = process.env.RENDER ? 'Render' : process.env.VERCEL ? 'Vercel' : 'Local'

        const totalTime = Math.round(performance.now() - startTime)

        return NextResponse.json({
            status: 'operational',
            timestamp: now.toISOString(),
            responseTime: totalTime,

            database: {
                status: 'connected',
                latency: dbLatency,
                provider: 'PostgreSQL',
                totalRecords,
                tables: {
                    users, projects, castingCalls, applications, donations,
                    subscribers, pageViews, filmViews, enrollments, courses, notifications,
                },
            },

            activity: {
                views24h,
                views1h,
                users24h,
                apps24h,
                requestsPerMinute: Math.round(views1h / 60 * 10) / 10,
            },

            runtime: {
                platform,
                environment,
                region,
                nodeVersion: process.version,
                uptime: Math.round(process.uptime()),
                memory: {
                    heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
                    heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
                    rss: Math.round(mem.rss / 1024 / 1024),
                    external: Math.round(mem.external / 1024 / 1024),
                    utilization: Math.round((mem.heapUsed / mem.heapTotal) * 100),
                },
            },

            services: [
                { name: 'Database', status: 'operational', latency: dbLatency },
                { name: 'Auth Service', status: 'operational', latency: null },
                { name: 'Email (Graph API)', status: process.env.AZURE_TENANT_ID ? 'configured' : 'not configured', latency: null },
                { name: 'SMS (Twilio)', status: process.env.ENABLE_SMS_NOTIFICATIONS === 'true' ? 'active' : 'mock mode', latency: null },
                { name: 'AI Engine (Gemini)', status: process.env.GEMINI_API_KEY ? 'operational' : 'not configured', latency: null },
                { name: 'OAuth (Google)', status: process.env.GOOGLE_CLIENT_ID ? 'configured' : 'not configured', latency: null },
            ],
        })
    } catch (err) {
        return NextResponse.json({
            status: 'degraded',
            error: err instanceof Error ? err.message : 'System check failed',
            timestamp: new Date().toISOString(),
        }, { status: 500 })
    }
}
