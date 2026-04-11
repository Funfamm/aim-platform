import { notFound, redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import ScriptVideoBackground from '@/components/scripts/ScriptVideoBackground'
import ScriptSubmissionStatus from '@/components/scripts/ScriptSubmissionStatus'
import { getLocale } from 'next-intl/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
    return {
        title: 'My Submission | AIM Studio',
        description: 'View your script submission status and details.',
    }
}

export default async function ScriptSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const locale = await getLocale()
    const session = await getUserSession()

    if (!session) {
        redirect(`/${locale}/login?redirect=/scripts/${id}/submission`)
    }

    // Get user email
    const user = await prisma.user.findUnique({
        where: { id: session.userId as string },
        select: { email: true },
    })

    if (!user?.email) redirect(`/${locale}/scripts/${id}`)

    // Find their submission for this call
    const submission = await prisma.scriptSubmission.findFirst({
        where: {
            scriptCallId: id,
            authorEmail: user.email,
        },
        include: {
            analysis: true,
            scriptCall: { select: { title: true } },
        },
        orderBy: { createdAt: 'desc' },
    })

    if (!submission) {
        // No submission found — redirect back to the call page
        redirect(`/${locale}/scripts/${id}`)
    }

    // Serialize for client component
    const serialized = {
        id: submission.id,
        title: submission.title,
        logline: submission.logline,
        synopsis: submission.synopsis,
        genre: submission.genre,
        estimatedDuration: submission.estimatedDuration,
        authorName: submission.authorName,
        authorEmail: submission.authorEmail,
        authorBio: submission.authorBio,
        scriptText: submission.scriptText ? submission.scriptText.slice(0, 500) + '...' : null,
        scriptFilePath: submission.scriptFilePath,
        status: submission.status,
        createdAt: submission.createdAt.toISOString(),
        analysis: submission.analysis ? {
            overallScore: submission.analysis.overallScore,
            originalityScore: submission.analysis.originalityScore,
            structureScore: submission.analysis.structureScore,
            dialogueScore: submission.analysis.dialogueScore,
            visualPotentialScore: submission.analysis.visualPotentialScore,
            themeAlignmentScore: submission.analysis.themeAlignmentScore,
            feasibilityScore: submission.analysis.feasibilityScore,
            strengths: submission.analysis.strengths,
            concerns: submission.analysis.concerns,
            recommendation: submission.analysis.recommendation,
        } : null,
    }

    return (
        <>
            <ScriptVideoBackground />
            <ScriptSubmissionStatus
                submission={serialized}
                callTitle={submission.scriptCall.title}
                callId={id}
            />
        </>
    )
}
