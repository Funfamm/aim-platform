import { NextResponse } from 'next/server'
import { getUserSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

/* eslint-disable @typescript-eslint/no-explicit-any */

// Simple in-memory rate limiter for quiz submissions
const quizRateLimit = new Map<string, number[]>()
const RATE_LIMIT_WINDOW = 60_000 // 1 minute
const RATE_LIMIT_MAX = 3 // max 3 submissions per minute

function checkRateLimit(key: string): boolean {
    const now = Date.now()
    const timestamps = (quizRateLimit.get(key) || []).filter(t => now - t < RATE_LIMIT_WINDOW)
    if (timestamps.length >= RATE_LIMIT_MAX) return false
    timestamps.push(now)
    quizRateLimit.set(key, timestamps)
    // Cleanup old entries periodically
    if (quizRateLimit.size > 1000) {
        for (const [k, v] of quizRateLimit) {
            if (v.every(t => now - t > RATE_LIMIT_WINDOW)) quizRateLimit.delete(k)
        }
    }
    return true
}

// GET — get quiz data for a module (without correct answers)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getUserSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: courseId } = await params
    const url = new URL(req.url)
    const moduleId = url.searchParams.get('moduleId')

    if (!moduleId) return NextResponse.json({ error: 'moduleId required' }, { status: 400 })

    // Verify enrollment
    const enrollment = await (prisma as any).enrollment.findUnique({
        where: { userId_courseId: { userId: session.userId, courseId } },
    })
    if (!enrollment) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })

    const quiz = await (prisma as any).quiz.findUnique({
        where: { moduleId },
        include: {
            questions: {
                orderBy: { sortOrder: 'asc' },
                select: {
                    id: true, questionText: true, questionType: true,
                    options: true, sortOrder: true, translations: true,
                    // NOTE: correctAnswer and explanation are NOT sent to the student
                },
            },
        },
    })

    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })

    // Get user's attempts
    const attempts = await (prisma as any).quizAttempt.findMany({
        where: { userId: session.userId, quizId: quiz.id },
        orderBy: { createdAt: 'desc' },
    })

    const hasPassed = attempts.some((a: any) => a.passed)
    let canAttempt = attempts.length < quiz.maxAttempts
    let reviewsNeeded = 0
    let reviewsDone = 0

    // If max attempts reached and not passed, check review activities for retake gating
    if (!canAttempt && !hasPassed && attempts.length > 0) {
        const lastAttempt = attempts[0]
        // Count review activities since last failed attempt
        const reviewsSinceLastAttempt = await (prisma as any).reviewActivity.count({
            where: {
                userId: session.userId,
                moduleId,
                createdAt: { gt: lastAttempt.createdAt },
            },
        })
        reviewsNeeded = 2 // Require 2 review activities to unlock retake
        reviewsDone = reviewsSinceLastAttempt
        if (reviewsSinceLastAttempt >= reviewsNeeded) {
            canAttempt = true // Unlock retake after sufficient review
        }
    }

    return NextResponse.json({
        quiz: {
            id: quiz.id,
            title: quiz.title,
            passMark: quiz.passMark,
            maxAttempts: quiz.maxAttempts,
            questionCount: quiz.questions.length,
            translations: quiz.translations || null,
            questions: quiz.questions.map((q: any) => ({
                id: q.id,
                questionText: q.questionText,
                questionType: q.questionType,
                options: typeof q.options === 'string' ? JSON.parse(q.options) : q.options,
                translations: q.translations,
            })),
        },
        attempts: attempts.map((a: any) => ({
            id: a.id,
            score: a.score,
            passed: a.passed,
            attemptNumber: a.attemptNumber,
            createdAt: a.createdAt,
        })),
        canAttempt,
        hasPassed,
        attemptsRemaining: canAttempt ? Math.max(1, quiz.maxAttempts - attempts.length) : 0,
        retakeGated: !canAttempt && !hasPassed,
        reviewsNeeded,
        reviewsDone,
    })
}

// POST — submit quiz answers
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getUserSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: courseId } = await params
    const body = await req.json()
    const { quizId, answers } = body

    if (!quizId || !answers) return NextResponse.json({ error: 'quizId and answers required' }, { status: 400 })

    // Rate limit: 3 submissions per minute
    if (!checkRateLimit(`${session.userId}:${quizId}`)) {
        return NextResponse.json({ error: 'Too many submissions. Please wait a moment.' }, { status: 429 })
    }

    // Verify enrollment
    const enrollment = await (prisma as any).enrollment.findUnique({
        where: { userId_courseId: { userId: session.userId, courseId } },
    })
    if (!enrollment) return NextResponse.json({ error: 'Not enrolled' }, { status: 403 })

    // Get quiz with correct answers
    const quiz = await (prisma as any).quiz.findUnique({
        where: { id: quizId },
        include: { questions: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })

    // Check attempt limit
    const existingAttempts = await (prisma as any).quizAttempt.count({
        where: { userId: session.userId, quizId },
    })
    if (existingAttempts >= quiz.maxAttempts) {
        return NextResponse.json({ error: 'Max attempts reached' }, { status: 403 })
    }

    // Grade the quiz
    let correctCount = 0
    const results: { questionId: string; correct: boolean; userAnswer: string; correctAnswer?: string; explanation?: string }[] = []

    for (const question of quiz.questions) {
        const userAnswer = answers[question.id] || ''
        const isCorrect = userAnswer.toLowerCase() === question.correctAnswer.toLowerCase()
        if (isCorrect) correctCount++

        results.push({
            questionId: question.id,
            correct: isCorrect,
            userAnswer,
            // Only show correct answer and explanation if they got it wrong
            ...(!isCorrect ? {
                correctAnswer: undefined, // Don't reveal correct answers on fail
                explanation: question.explanation || undefined,
            } : {}),
        })
    }

    const score = quiz.questions.length > 0
        ? Math.round((correctCount / quiz.questions.length) * 100)
        : 0
    const passed = score >= quiz.passMark

    // Save attempt
    const attempt = await (prisma as any).quizAttempt.create({
        data: {
            userId: session.userId,
            quizId,
            score,
            passed,
            answers: JSON.stringify(answers),
            attemptNumber: existingAttempts + 1,
        },
    })

    // XP for quiz completion
    let xpGained = 15
    if (passed) xpGained += 35

    await (prisma as any).user.update({
        where: { id: session.userId },
        data: { trainingXp: { increment: xpGained } },
    })

    return NextResponse.json({
        attempt: {
            id: attempt.id,
            score,
            passed,
            attemptNumber: existingAttempts + 1,
        },
        results,
        correctCount,
        totalQuestions: quiz.questions.length,
        xpGained,
        attemptsRemaining: Math.max(0, quiz.maxAttempts - existingAttempts - 1),
    })
}
