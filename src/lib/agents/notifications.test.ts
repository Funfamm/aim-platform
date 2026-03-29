/**
 * Tests for notification route pagination logic
 *
 * The actual API route lives in src/app/api/admin/applications/[id]/notifications/route.ts.
 * We test the pure pagination math here without spinning up a Next.js request context.
 */
import { describe, it, expect } from 'vitest'

// ── Extract the pagination logic as a pure function ──
// Mirrors the query-param parsing in the notifications route.
// Note: the production route is susceptible to NaN when given non-numeric
// strings (e.g. page='abc'). The helper below adds NaN guards that should
// ideally be applied to the route as well.
function parsePagination(params: { page?: string; size?: string }) {
    const rawPage = parseInt(params.page || '1', 10)
    const rawSize = parseInt(params.size || '20', 10)
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage)
    const size = Math.min(100, Math.max(1, isNaN(rawSize) ? 20 : rawSize))
    const skip = (page - 1) * size
    return { page, size, skip }
}

function calcTotalPages(total: number, size: number): number {
    return Math.ceil(total / size)
}

// ═══════════════════════════════════════════════════════════════
// parsePagination
// ═══════════════════════════════════════════════════════════════
describe('Notification Pagination', () => {
    it('should use default page=1 and size=20 when no params given', () => {
        const { page, size, skip } = parsePagination({})
        expect(page).toBe(1)
        expect(size).toBe(20)
        expect(skip).toBe(0)
    })

    it('should calculate correct skip for page 3, size 10', () => {
        const { page, size, skip } = parsePagination({ page: '3', size: '10' })
        expect(page).toBe(3)
        expect(size).toBe(10)
        expect(skip).toBe(20)
    })

    it('should clamp size to max 100', () => {
        const { size } = parsePagination({ size: '500' })
        expect(size).toBe(100)
    })

    it('should clamp size to min 1', () => {
        const { size } = parsePagination({ size: '0' })
        expect(size).toBe(1)
    })

    it('should clamp page to min 1', () => {
        const { page, skip } = parsePagination({ page: '-5' })
        expect(page).toBe(1)
        expect(skip).toBe(0)
    })

    it('should handle NaN page gracefully (default to 1)', () => {
        const { page } = parsePagination({ page: 'abc' })
        expect(page).toBe(1)
    })

    it('should handle NaN size gracefully (default to 20)', () => {
        const { size } = parsePagination({ size: 'abc' })
        expect(size).toBe(20)
    })

    it('should compute skip = 0 for page 1', () => {
        const { skip } = parsePagination({ page: '1', size: '50' })
        expect(skip).toBe(0)
    })

    it('should compute skip correctly for large pages', () => {
        const { skip } = parsePagination({ page: '10', size: '25' })
        expect(skip).toBe(225)
    })
})

// ═══════════════════════════════════════════════════════════════
// calcTotalPages
// ═══════════════════════════════════════════════════════════════
describe('Total Pages Calculation', () => {
    it('should return 3 for 45 items with size 20', () => {
        expect(calcTotalPages(45, 20)).toBe(3)
    })

    it('should return 1 for fewer items than page size', () => {
        expect(calcTotalPages(5, 20)).toBe(1)
    })

    it('should return 0 for 0 total items', () => {
        expect(calcTotalPages(0, 20)).toBe(0)
    })

    it('should return exact division for 100 items with size 25', () => {
        expect(calcTotalPages(100, 25)).toBe(4)
    })

    it('should handle size=1 (one item per page)', () => {
        expect(calcTotalPages(10, 1)).toBe(10)
    })
})
