/**
 * Deterministic Test Data Seed
 *
 * Creates a predictable set of records for integration and E2E tests.
 * Uses fixed UUIDs so tests can reference them by ID.
 *
 * Usage (in test setup):
 *   import { seedTestData, cleanTestData } from '../tests/setup/seed'
 *   beforeAll(() => seedTestData())
 *   afterAll(() => cleanTestData())
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ── Fixed IDs for deterministic referencing ──────────────────────────
export const TEST_IDS = {
    ADMIN_USER:     'test-admin-00000000-0000-0000-0000-000000000001',
    SUPER_ADMIN:    'test-super-00000000-0000-0000-0000-000000000002',
    MEMBER_USER:    'test-member-0000000-0000-0000-0000-000000000003',
    PROJECT_1:      'test-proj-000000000-0000-0000-0000-000000000001',
    CASTING_CALL_1: 'test-cast-000000000-0000-0000-0000-000000000001',
    SPONSOR_1:      'test-sponsor-00000-0000-0000-0000-000000000001',
} as const

export async function seedTestData() {
    const passwordHash = await bcrypt.hash('TestP@ss123!', 10)

    // ── Users ────────────────────────────────────────────────────
    await prisma.user.upsert({
        where: { id: TEST_IDS.SUPER_ADMIN },
        update: {},
        create: {
            id: TEST_IDS.SUPER_ADMIN,
            name: 'Test SuperAdmin',
            email: 'superadmin@test.dev',
            passwordHash,
            role: 'superadmin',
            emailVerified: true,
            tokenVersion: 0,
        },
    })

    await prisma.user.upsert({
        where: { id: TEST_IDS.ADMIN_USER },
        update: {},
        create: {
            id: TEST_IDS.ADMIN_USER,
            name: 'Test Admin',
            email: 'admin@test.dev',
            passwordHash,
            role: 'admin',
            emailVerified: true,
            tokenVersion: 0,
        },
    })

    await prisma.user.upsert({
        where: { id: TEST_IDS.MEMBER_USER },
        update: {},
        create: {
            id: TEST_IDS.MEMBER_USER,
            name: 'Test Member',
            email: 'member@test.dev',
            passwordHash,
            role: 'member',
            emailVerified: true,
            tokenVersion: 0,
        },
    })

    // ── Project ──────────────────────────────────────────────────
    await prisma.project.upsert({
        where: { id: TEST_IDS.PROJECT_1 },
        update: {},
        create: {
            id: TEST_IDS.PROJECT_1,
            title: 'Test Project Alpha',
            slug: 'test-project-alpha',
            description: 'A test project for E2E validation.',
            status: 'completed',
            genre: 'Drama',
            projectType: 'movie',
        },
    })

    // ── Casting Call ─────────────────────────────────────────────
    await prisma.castingCall.upsert({
        where: { id: TEST_IDS.CASTING_CALL_1 },
        update: {},
        create: {
            id: TEST_IDS.CASTING_CALL_1,
            projectId: TEST_IDS.PROJECT_1,
            roleName: 'Lead Actor',
            roleDescription: 'A test casting call for the lead role.',
            requirements: 'Must have prior acting experience.',
            ageRange: '18-30',
            gender: 'Any',
            deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'open',
        },
    })

    // ── Sponsor ──────────────────────────────────────────────────
    await prisma.sponsor.upsert({
        where: { id: TEST_IDS.SPONSOR_1 },
        update: {},
        create: {
            id: TEST_IDS.SPONSOR_1,
            name: 'Test Sponsor Inc.',
            website: 'https://test-sponsor.dev',
            tier: 'gold',
            active: true,
        },
    })

    console.log('✅ Test data seeded successfully')
}

export async function cleanTestData() {
    // Delete in reverse order of dependencies
    await prisma.application.deleteMany({ where: { castingCallId: TEST_IDS.CASTING_CALL_1 } })
    await prisma.castingCall.deleteMany({ where: { id: TEST_IDS.CASTING_CALL_1 } })
    await prisma.project.deleteMany({ where: { id: TEST_IDS.PROJECT_1 } })
    await prisma.sponsor.deleteMany({ where: { id: TEST_IDS.SPONSOR_1 } })
    await prisma.user.deleteMany({
        where: { id: { in: [TEST_IDS.ADMIN_USER, TEST_IDS.SUPER_ADMIN, TEST_IDS.MEMBER_USER] } },
    })

    await prisma.$disconnect()
    console.log('🧹 Test data cleaned')
}
