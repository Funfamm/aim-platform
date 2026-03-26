import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { callGemini } from '@/lib/gemini'
import { prisma } from '@/lib/db'

export async function POST(req: Request) {
    try { await requireAdmin() } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

    const { question, context } = await req.json()
    if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 })

    // Pull fresh snapshot of key numbers to ground the answer
    const now = new Date()
    const month = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [monthViews, weekViews, totalUsers, appsMonth, subscribers, openCastings] = await Promise.all([
        prisma.pageView.count({ where: { createdAt: { gte: month } } }),
        prisma.pageView.count({ where: { createdAt: { gte: week } } }),
        prisma.user.count(),
        prisma.application.count({ where: { createdAt: { gte: month } } }),
        prisma.subscriber.count(),
        prisma.castingCall.count({ where: { status: 'open' } }),
    ])

    const prompt = `You are the AI Analytics Agent for AIM Studio — an AI-powered independent film production platform.

You have just provided these insights to the studio team:
${context}

Current platform snapshot:
- Page views (30d): ${monthViews} | This week: ${weekViews}
- Total users: ${totalUsers} | New applications (30d): ${appsMonth}
- Subscribers: ${subscribers} | Open casting calls: ${openCastings}

The admin is now asking a follow-up question: "${question}"

Answer concisely and specifically — reference actual numbers where relevant. Keep your answer to 2-4 sentences max. Speak directly to the admin as a trusted advisor. Do not add lists or headers, just a direct, conversational answer.`

    const result = await callGemini(prompt, 'analytics')

    if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ answer: result.text.trim(), keyUsed: result.keyLabel })
}
