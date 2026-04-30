export interface CategoryBreakdown {
    key: string; label: string; count: number; percentage: number
}
export interface FreeTextItem {
    id: string; text: string; createdAt: string; country: string | null; flagged: boolean; converted: boolean
}
export interface RecentResponse {
    id: string; email: string | null; selections: string[]; country: string | null
    createdAt: string; converted: boolean; flagged: boolean
}
export interface DeliveryLogEntry {
    to: string; success: boolean; transport: string | null; sentAt: string | null; error: string | null
}
export interface DeliveryStats {
    total: number; sent: number; pending: number; processing: number; failed: number; cancelled: number
    log: DeliveryLogEntry[]
}
export interface FunnelData {
    emailsQueued: number; emailsSent: number; surveyCompleted: number; clickedRegister: number; actuallyRegistered: number
    openRate: number | null; completionRate: number | null; conversionRate: number | null
}
export interface GenreConversion {
    genre: string; totalSelections: number; conversions: number; conversionRate: number
}
export interface CountryStat { country: string; count: number; percentage: number }
export interface GenreByCountry { country: string; topGenre: string; count: number }
export interface DayStat { date: string; count: number }
export interface HourStat { hour: number; count: number }
export interface FlaggedByCountry { country: string; count: number }

export interface SurveyData {
    totalResponses: number; responsesLast24h: number; responsesThisWeek: number
    convertedCount: number; convertedPercentage: number; openTextCount: number; countriesReached: number
    categoryBreakdown: CategoryBreakdown[]
    mostPopularCombination: { selections: string[]; count: number }
    singleSelectionRate: number; multiSelectionRate: number; allSelectedRate: number
    avgSelectionsPerResponse: number; openTextRate: number
    topCountries: CountryStat[]; genreByCountry: GenreByCountry[]
    funnel: FunnelData; genreConversionCorrelation: GenreConversion[]; avgTimeToConvert: number | null
    responsesByDay: DayStat[]; peakHours: HourStat[]
    velocityFirst24h: number; velocityAfter24h: number
    flaggedCount: number; flaggedByCountry: FlaggedByCountry[]; cleanResponseRate: number
    freeTextResponses: FreeTextItem[]; freeTextTotal: number; freeTextFlaggedCount: number; freeTextConvertedCount: number
    recentResponses: RecentResponse[]; recentTotal: number
    surveyId: string | null; delivery?: DeliveryStats; empty?: boolean
}

export function countryFlag(code: string | null): string {
    if (!code || code.length !== 2) return '🌍'
    const offset = 0x1F1E6
    return String.fromCodePoint(code.charCodeAt(0) - 65 + offset, code.charCodeAt(1) - 65 + offset)
}

export function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}
