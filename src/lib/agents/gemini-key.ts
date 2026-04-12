import { prisma } from '@/lib/db'

/**
 * Get an available Gemini key for a specific agent (e.g. 'audition', 'scripts', 'training').
 * Falls back to ANY active Gemini key only if strict=false (default).
 *
 * @param agent           - The agent name to look up keys for (default: 'audition')
 * @param dailyExhaustedKeys - Set of key IDs to skip (daily quota exhausted)
 * @param strict          - If true, skip the fallback and return null if no assigned key found
 */
export async function getAvailableGeminiKey(
    dailyExhaustedKeys?: Set<string>,
    agent: string = 'audition',
    strict: boolean = false,
): Promise<{ id: string; key: string; label: string; model: string } | null> {
    const exhaustedIds = dailyExhaustedKeys ? Array.from(dailyExhaustedKeys) : []

    // First: keys explicitly assigned to this agent or 'all'
    const agentKey = await prisma.apiKey.findFirst({
        where: {
            provider: 'gemini',
            isActive: true,
            assignedAgent: { in: [agent, 'all'] },
            id: { notIn: exhaustedIds },
        },
        orderBy: { lastUsed: 'asc' },
    })

    if (agentKey) return { id: agentKey.id, key: agentKey.key, label: agentKey.label, model: 'gemini-2.5-flash' }

    if (strict) return null

    // Fallback: any active Gemini key (ignore assignedAgent)
    const fallbackKey = await prisma.apiKey.findFirst({
        where: {
            provider: 'gemini',
            isActive: true,
            id: { notIn: exhaustedIds },
        },
        orderBy: { lastUsed: 'asc' },
    })

    if (fallbackKey) return { id: fallbackKey.id, key: fallbackKey.key, label: fallbackKey.label, model: 'gemini-2.5-flash' }

    return null
}
