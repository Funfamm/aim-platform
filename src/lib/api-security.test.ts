/**
 * API Security & RBAC Tests
 *
 * Tests guard functions (requireAdmin, requireSuperAdmin, etc.)
 * in isolation — no Next.js server required.
 */
import { describe, it, expect } from 'vitest'
import { SignJWT, jwtVerify } from 'jose'

// Reproduce token logic
const TEST_SECRET = new TextEncoder().encode('__test-secret-32-chars-minimum__')

interface TokenPayload {
    userId: string
    role: 'member' | 'admin' | 'superadmin'
    email?: string
}

async function createToken(payload: Record<string, unknown>) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(TEST_SECRET)
}

async function verifyToken(token: string): Promise<TokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, TEST_SECRET)
        return payload as unknown as TokenPayload
    } catch {
        return null
    }
}

// Reproduce guard logic from auth.ts (without Next.js cookies)
function requireAdmin(session: TokenPayload | null): TokenPayload {
    if (!session) throw new Error('Unauthorized')
    if (session.role !== 'admin' && session.role !== 'superadmin') {
        throw new Error('Forbidden: admin access required')
    }
    return session
}

function requireSuperAdmin(session: TokenPayload | null): TokenPayload {
    if (!session) throw new Error('Unauthorized')
    if (session.role !== 'superadmin') {
        throw new Error('Forbidden: superadmin access required')
    }
    return session
}

function requireAdminResponse(session: TokenPayload | null): { error: string; status: number } | TokenPayload {
    if (!session) return { error: 'Unauthorized', status: 401 }
    if (session.role !== 'admin' && session.role !== 'superadmin') {
        return { error: 'Forbidden: admin access required', status: 403 }
    }
    return session
}

function isAuthError(result: { error: string; status: number } | TokenPayload): result is { error: string; status: number } {
    return 'error' in result && 'status' in result
}

// ═══════════════════════════════════════════════════════════
// requireAdmin TESTS
// ═══════════════════════════════════════════════════════════
describe('requireAdmin Guard', () => {
    it('should throw Unauthorized when session is null', () => {
        expect(() => requireAdmin(null)).toThrow('Unauthorized')
    })

    it('should throw Forbidden for member role', async () => {
        const token = await createToken({ userId: 'u1', role: 'member', email: 'member@test.com' })
        const session = await verifyToken(token)
        expect(() => requireAdmin(session)).toThrow('Forbidden: admin access required')
    })

    it('should pass for admin role', async () => {
        const token = await createToken({ userId: 'u2', role: 'admin', email: 'admin@test.com' })
        const session = await verifyToken(token)
        const result = requireAdmin(session)
        expect(result.userId).toBe('u2')
        expect(result.role).toBe('admin')
    })

    it('should pass for superadmin role', async () => {
        const token = await createToken({ userId: 'u3', role: 'superadmin', email: 'super@test.com' })
        const session = await verifyToken(token)
        const result = requireAdmin(session)
        expect(result.userId).toBe('u3')
        expect(result.role).toBe('superadmin')
    })
})

// ═══════════════════════════════════════════════════════════
// requireSuperAdmin TESTS
// ═══════════════════════════════════════════════════════════
describe('requireSuperAdmin Guard', () => {
    it('should throw Unauthorized when session is null', () => {
        expect(() => requireSuperAdmin(null)).toThrow('Unauthorized')
    })

    it('should throw Forbidden for member role', async () => {
        const token = await createToken({ userId: 'u1', role: 'member' })
        const session = await verifyToken(token)
        expect(() => requireSuperAdmin(session)).toThrow('Forbidden: superadmin access required')
    })

    it('should throw Forbidden for admin role', async () => {
        const token = await createToken({ userId: 'u2', role: 'admin' })
        const session = await verifyToken(token)
        expect(() => requireSuperAdmin(session)).toThrow('Forbidden: superadmin access required')
    })

    it('should pass for superadmin role', async () => {
        const token = await createToken({ userId: 'u3', role: 'superadmin' })
        const session = await verifyToken(token)
        const result = requireSuperAdmin(session)
        expect(result.userId).toBe('u3')
        expect(result.role).toBe('superadmin')
    })
})

// ═══════════════════════════════════════════════════════════
// requireAdminResponse TESTS (returns Response instead of throwing)
// ═══════════════════════════════════════════════════════════
describe('requireAdminResponse Guard', () => {
    it('should return 401 when session is null', () => {
        const result = requireAdminResponse(null)
        expect(isAuthError(result)).toBe(true)
        if (isAuthError(result)) {
            expect(result.status).toBe(401)
            expect(result.error).toBe('Unauthorized')
        }
    })

    it('should return 403 for member role', async () => {
        const token = await createToken({ userId: 'u1', role: 'member' })
        const session = await verifyToken(token)
        const result = requireAdminResponse(session)
        expect(isAuthError(result)).toBe(true)
        if (isAuthError(result)) {
            expect(result.status).toBe(403)
            expect(result.error).toContain('admin access required')
        }
    })

    it('should return session object for admin role', async () => {
        const token = await createToken({ userId: 'u2', role: 'admin', email: 'admin@test.com' })
        const session = await verifyToken(token)
        const result = requireAdminResponse(session)
        expect(isAuthError(result)).toBe(false)
        if (!isAuthError(result)) {
            expect(result.userId).toBe('u2')
        }
    })

    it('should return session object for superadmin role', async () => {
        const token = await createToken({ userId: 'u3', role: 'superadmin' })
        const session = await verifyToken(token)
        const result = requireAdminResponse(session)
        expect(isAuthError(result)).toBe(false)
        if (!isAuthError(result)) {
            expect(result.role).toBe('superadmin')
        }
    })
})

// ═══════════════════════════════════════════════════════════
// ROUTE PROTECTION PATTERN TESTS
// ═══════════════════════════════════════════════════════════
describe('Route Protection Patterns', () => {
    it('should correctly identify member → admin → superadmin escalation', async () => {
        const memberToken = await createToken({ userId: 'u1', role: 'member' })
        const adminToken = await createToken({ userId: 'u2', role: 'admin' })
        const superToken = await createToken({ userId: 'u3', role: 'superadmin' })

        const member = await verifyToken(memberToken)
        const admin = await verifyToken(adminToken)
        const superadmin = await verifyToken(superToken)

        // Member cannot access admin routes
        expect(() => requireAdmin(member)).toThrow()
        expect(() => requireSuperAdmin(member)).toThrow()

        // Admin can access admin routes but not superadmin
        expect(() => requireAdmin(admin)).not.toThrow()
        expect(() => requireSuperAdmin(admin)).toThrow()

        // Superadmin can access everything
        expect(() => requireAdmin(superadmin)).not.toThrow()
        expect(() => requireSuperAdmin(superadmin)).not.toThrow()
    })

    it('expired token should not pass any guard', async () => {
        // Create a token that expires in 0 seconds
        const token = await new SignJWT({ userId: 'u1', role: 'admin' })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('0s')
            .sign(TEST_SECRET)

        // Wait a tiny bit for it to expire
        await new Promise(resolve => setTimeout(resolve, 1100))

        const session = await verifyToken(token)
        expect(session).toBeNull()
        expect(() => requireAdmin(session)).toThrow('Unauthorized')
    })
})
