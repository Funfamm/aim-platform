'use server'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'

/**
 * POST /api/casting/[id]/withdraw
 * Allows a user to withdraw their application for a casting call.
 * Withdrawal is only permitted if the application is still pending (i.e., not yet adjudicated by AI).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: castingCallId } = await params

    // Verify user session
    const session = await getUserSession()
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = session.userId

    // Find the application for this user and casting call
    const application = await prisma.application.findFirst({
      where: { castingCallId, userId },
    })
    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Allow withdrawal only if status is still pending (submitted or under_review)
    const nonWithdrawableStatuses = ['shortlisted', 'callback', 'final_review', 'selected', 'not_selected']
    if (nonWithdrawableStatuses.includes(application.status)) {
      return NextResponse.json({ error: 'Cannot withdraw after the audition has been processed' }, { status: 409 })
    }

    // Update status to withdrawn
    await prisma.application.update({
      where: { id: application.id },
      data: { status: 'withdrawn' },
    })

    return NextResponse.json({ success: true, message: 'Application withdrawn' })
  } catch (error) {
    console.error('Withdraw error:', error)
    return NextResponse.json({ error: 'Failed to withdraw application' }, { status: 500 })
  }
}
