import { prisma } from '@/lib/db'

/**
 * Generate a sequential project request ID in AIM-YYYYMMDD-NNN format.
 * Queries today's count from the database for collision-safe sequencing.
 */
export async function generateProjectId(): Promise<string> {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    const datePrefix = `AIM-${yyyy}${mm}${dd}`

    // Count how many requests were created today with this prefix
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const count = await prisma.projectRequest.count({
        where: {
            id: { startsWith: datePrefix },
            createdAt: { gte: todayStart },
        },
    })

    const seq = String(count + 1).padStart(3, '0')
    return `${datePrefix}-${seq}`
}
