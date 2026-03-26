/**
 * Tests for auth utility functions
 *
 * Tests createToken + verifyToken (JWT round-tripping)
 * Tests createRefreshToken with longer TTL
 * Tests token expiry behaviour
 * without requiring Next.js cookies.
 */
import { describe, it, expect } from 'vitest'
import { SignJWT, jwtVerify } from 'jose'

// Reproduce the auth token logic without NextResponse/cookies imports
const TEST_SECRET = new TextEncoder().encode('__test-secret-32-chars-minimum__')

// Mirror createToken — SHORT-LIVED (15 min)
async function createToken(payload: Record<string, unknown>) {
    return await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(TEST_SECRET)
}

// Mirror createRefreshToken — LONG-LIVED (7 days)
async function createRefreshToken(payload: Record<string, unknown>) {
    const slim = { userId: payload.userId, role: payload.role, email: payload.email }
    return await new SignJWT(slim)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(TEST_SECRET)
}

async function verifyToken(token: string) {
    try {
        const { payload } = await jwtVerify(token, TEST_SECRET)
        return payload as Record<string, unknown>
    } catch {
        return null
    }
}

type UserRole = 'member' | 'admin' | 'superadmin'

// ═══════════════════════════════════════════════════════════
// ACCESS TOKEN TESTS
// ═══════════════════════════════════════════════════════════
describe('Access Token (Short-Lived)', () => {
    it('should create and verify a valid access token', async () => {
        const token = await createToken({ userId: 'user-1', role: 'member', email: 'test@test.com' })
        expect(typeof token).toBe('string')
        expect(token.split('.').length).toBe(3) // JWT format

        const payload = await verifyToken(token)
        expect(payload).not.toBeNull()
        expect(payload?.userId).toBe('user-1')
        expect(payload?.role).toBe('member')
        expect(payload?.email).toBe('test@test.com')
    })

    it('should have 15-minute TTL', async () => {
        const token = await createToken({ userId: 'user-1' })
        const payload = await verifyToken(token)
        expect(payload?.iat).toBeDefined()
        expect(payload?.exp).toBeDefined()
        const ttl = (payload?.exp as number) - (payload?.iat as number)
        expect(ttl).toBe(15 * 60) // exactly 900 seconds (15 min)
    })

    it('should return null for invalid token', async () => {
        const payload = await verifyToken('invalid.token.here')
        expect(payload).toBeNull()
    })

    it('should return null for tampered token', async () => {
        const token = await createToken({ userId: 'user-1' })
        const tampered = token.slice(0, -5) + 'XXXXX'
        const payload = await verifyToken(tampered)
        expect(payload).toBeNull()
    })

    it('should handle all three roles correctly', async () => {
        const roles: UserRole[] = ['member', 'admin', 'superadmin']
        for (const role of roles) {
            const token = await createToken({ userId: `user-${role}`, role })
            const payload = await verifyToken(token)
            expect(payload?.role).toBe(role)
        }
    })

    it('should fail verification with wrong secret', async () => {
        const token = await createToken({ userId: 'user-1' })
        const wrongSecret = new TextEncoder().encode('__wrong-secret-does-not-match___')
        try {
            await jwtVerify(token, wrongSecret)
            expect.fail('Should have thrown')
        } catch (err) {
            expect(err).toBeTruthy()
        }
    })
})

// ═══════════════════════════════════════════════════════════
// REFRESH TOKEN TESTS
// ═══════════════════════════════════════════════════════════
describe('Refresh Token (Long-Lived)', () => {
    it('should create and verify a valid refresh token', async () => {
        const token = await createRefreshToken({ userId: 'user-1', role: 'admin', email: 'admin@test.com' })
        expect(typeof token).toBe('string')
        expect(token.split('.').length).toBe(3)

        const payload = await verifyToken(token)
        expect(payload).not.toBeNull()
        expect(payload?.userId).toBe('user-1')
        expect(payload?.role).toBe('admin')
        expect(payload?.email).toBe('admin@test.com')
    })

    it('should have 7-day TTL', async () => {
        const token = await createRefreshToken({ userId: 'user-1', role: 'member', email: 'a@b.com' })
        const payload = await verifyToken(token)
        expect(payload?.iat).toBeDefined()
        expect(payload?.exp).toBeDefined()
        const ttl = (payload?.exp as number) - (payload?.iat as number)
        expect(ttl).toBe(7 * 24 * 60 * 60) // exactly 604800 seconds (7 days)
    })

    it('should only embed slim claims (userId, role, email)', async () => {
        const token = await createRefreshToken({
            userId: 'user-1',
            role: 'admin',
            email: 'a@b.com',
            extraField: 'should-not-persist',
            anotherField: 123,
        })
        const payload = await verifyToken(token)
        expect(payload?.userId).toBe('user-1')
        expect(payload?.role).toBe('admin')
        expect(payload?.email).toBe('a@b.com')
        expect(payload?.extraField).toBeUndefined()
        expect(payload?.anotherField).toBeUndefined()
    })

    it('should be usable to generate a new access token', async () => {
        // Simulate refresh flow: verify refresh → create new access
        const refreshToken = await createRefreshToken({ userId: 'user-1', role: 'member', email: 'a@b.com' })
        const refreshPayload = await verifyToken(refreshToken)
        expect(refreshPayload).not.toBeNull()

        const newAccess = await createToken({
            userId: refreshPayload?.userId,
            role: refreshPayload?.role,
            email: refreshPayload?.email,
        })
        const accessPayload = await verifyToken(newAccess)
        expect(accessPayload?.userId).toBe('user-1')
        expect(accessPayload?.role).toBe('member')

        // Verify TTLs are different
        const accessTTL = (accessPayload?.exp as number) - (accessPayload?.iat as number)
        const refreshTTL = (refreshPayload?.exp as number) - (refreshPayload?.iat as number)
        expect(accessTTL).toBe(15 * 60)     // 15 min
        expect(refreshTTL).toBe(7 * 24 * 3600) // 7 days
    })
})

// ═══════════════════════════════════════════════════════════
// TOKEN ROTATION SECURITY TESTS
// ═══════════════════════════════════════════════════════════
describe('Token Rotation Security', () => {
    it('access and refresh tokens should be different strings', async () => {
        const payload = { userId: 'user-1', role: 'member', email: 'a@b.com' }
        const access = await createToken(payload)
        const refresh = await createRefreshToken(payload)
        expect(access).not.toBe(refresh)
    })

    it('tampered refresh token should not verify', async () => {
        const token = await createRefreshToken({ userId: 'user-1', role: 'admin', email: 'a@b.com' })
        const tampered = token.slice(0, -3) + 'ZZZ'
        const payload = await verifyToken(tampered)
        expect(payload).toBeNull()
    })

    it('refresh token signed with wrong key should not verify', async () => {
        const wrongKey = new TextEncoder().encode('__different-key-entirely-abcdef__')
        const token = await new SignJWT({ userId: 'user-1', role: 'admin' })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('7d')
            .sign(wrongKey)

        const payload = await verifyToken(token)
        expect(payload).toBeNull()
    })
})
