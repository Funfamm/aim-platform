export interface Analytics {
    period: string
    allTime: { totalSent: number; totalSuccess: number; totalFailed: number; totalOpened: number; successRate: number; openRate: number }
    periodStats: { days: number; sent: number; success: number; failed: number; opened: number; successRate: number; openRate: number }
    bounceStats: Record<string, number>
    typeBreakdown: { type: string; count: number }[]
    transportBreakdown: { transport: string; count: number }[]
    chartVolume: { period: string; sent: number; failed: number; opened: number }[]
    healthScore: { score: number; successRate: number; hardBounceRate: number; complaintRate: number; suppressedCount: number; grade: string }
    suppression: { totalActive: number; addedLast30Days: number }
    topFailing: { email: string; failures: number }[]
    emailLog: { records: LogRecord[]; total: number; page: number; limit: number; totalPages: number }
}

export interface LogRecord {
    id: string; to: string; subject: string; type: string; transport: string
    success: boolean; error: string | null; bounceCategory: string | null
    sentAt: string; openedAt: string | null
}

export interface SuppressionData {
    records: SuppressionRecord[]; total: number; page: number; limit: number; totalPages: number
    stats: Record<string, number>; totalActive: number
}

export interface SuppressionRecord {
    id: string; email: string; reason: string; bounceType: string | null
    source: string; detail: string | null; createdAt: string
    expiresAt: string | null; removedAt: string | null; removedBy: string | null
}

export interface ImportResult { success: boolean; total: number; imported: number; skippedDuplicate: number; skippedInvalid: number; errors: string[] }
