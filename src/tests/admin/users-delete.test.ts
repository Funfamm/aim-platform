// src/tests/admin/users-delete.test.ts
/**
 * Integration test for the bulk‑delete endpoint ensuring email anonymisation.
 * Simplified to avoid external HTTP calls; it verifies that:
 *   1️⃣ The DELETE endpoint returns 200.
 *   2️⃣ Application email is anonymised.
 *   3️⃣ A new user can be created with the same original email after deletion.
 */
import { DELETE } from '@/app/api/admin/users/route';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';

// Mock the admin guard so it always succeeds
import { vi } from 'vitest';
vi.mock('@/lib/auth', () => ({ requireAdmin: vi.fn().mockResolvedValue(undefined) }));

describe('Admin bulk delete – email anonymisation', () => {
  const email = 'leak@test.com';
  let userId: string;

  beforeAll(async () => {
    // Ensure clean state from any previous failed runs
    await prisma.application.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.castingCall.deleteMany({ where: { roleName: 'Test Role' } });
    await prisma.project.deleteMany({ where: { slug: 'test-project' } });

    // Create a regular user
    const user = await prisma.user.create({
      data: {
        name: 'Leak',
        email,
        passwordHash: 'hash', // placeholder
        role: 'member',
      },
    });
    userId = user.id;

    // Create a minimal project for the casting call
    const project = await prisma.project.create({
      data: {
        title: 'Test Project',
        slug: 'test-project',
        description: 'Test project description',
        status: 'upcoming',
        projectType: 'movie',
      },
    });
    // Create a casting call linked to the project
    const castingCall = await prisma.castingCall.create({
      data: {
        projectId: project.id,
        roleName: 'Test Role',
        roleDescription: 'Test role description',
        maxApplications: 10,
        requirements: 'None',
      },
    });
    // Create a guest application linked by email (no userId)
    await prisma.application.create({
      data: {
        castingCallId: castingCall.id,
        fullName: 'Leak',
        email,
        status: 'submitted',
        experience: 'test experience',
      },
    });
  });

  afterAll(async () => {
    // Clean up any test data
    await prisma.application.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email } });
    await prisma.castingCall.deleteMany({ where: { roleName: 'Test Role' } });
    await prisma.project.deleteMany({ where: { slug: 'test-project' } });
  });

  it('should anonymise email and allow fresh registration', async () => {
    // Build a NextRequest for the DELETE endpoint
    const req = new NextRequest('http://localhost/api/admin/users', {
      method: 'DELETE',
      body: JSON.stringify({ ids: [userId] }),
    });

    const res = await DELETE(req);
    expect(res.status).toBe(200);

    // Verify the application email has been anonymised
    const app = await prisma.application.findFirst({ where: { fullName: 'Leak' } });
    expect(app?.email).toMatch(/^deleted_/);

    // Attempt to create a new user with the same original email – should succeed
    const newUser = await prisma.user.create({
      data: {
        name: 'New',
        email,
        passwordHash: 'hash2',
        role: 'member',
      },
    });
    expect(newUser.email).toBe(email);
  });
});
