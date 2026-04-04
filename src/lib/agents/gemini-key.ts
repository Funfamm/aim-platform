import { prisma } from '@/lib/db'

/**
 * Get an available Gemini key for vision screening.
 * Falls back to ANY active Gemini key if none are explicitly assigned to agents.
 */
export async function getAvailableGeminiKey(dailyExhaustedKeys?: Set<string>): Promise<{ id: string; key: string; label: string; model: string } | null> {
    const exhaustedIds = dailyExhaustedKeys ? Array.from(dailyExhaustedKeys) : []
    
    // First try keys explicitly assigned to the audition or 'all'
    const agentKey = await prisma.apiKey.findFirst({
        where: { 
            provider: 'gemini', 
            isActive: true, 
            assignedAgent: { in: ['audition', 'all'] },
            id: { notIn: exhaustedIds } 
        },
        orderBy: { lastUsed: 'asc' },
    })
    
    if (agentKey) return { id: agentKey.id, key: agentKey.key, label: agentKey.label, model: 'gemini-2.5-flash' }
    
    // Fallback: any active Gemini key (ignore assignedAgent)
    const fallbackKey = await prisma.apiKey.findFirst({
        where: { 
            provider: 'gemini', 
            isActive: true,
            id: { notIn: exhaustedIds } 
        },
        orderBy: { lastUsed: 'asc' },
    })
    
    if (fallbackKey) return { id: fallbackKey.id, key: fallbackKey.key, label: fallbackKey.label, model: 'gemini-2.5-flash' }
    
    return null
}
