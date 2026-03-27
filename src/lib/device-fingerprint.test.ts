import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock heavy dependencies so the test doesn't need a DB or mailer
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))
vi.mock('@/lib/mailer', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/cached-settings', () => ({
  getCachedSettings: vi.fn().mockResolvedValue({ notifyOnNewDevice: false }),
}))
vi.mock('@/lib/email-templates', () => ({ newDeviceLoginEmail: vi.fn().mockReturnValue('html') }))

import { handleDeviceFingerprint } from '@/lib/device-fingerprint'
import { prisma } from '@/lib/db'

const mockFindUnique = prisma.user.findUnique as ReturnType<typeof vi.fn>
const mockUpdate = prisma.user.update as ReturnType<typeof vi.fn>

function makeRequest(ua: string, ip: string): Request {
  return new Request('http://localhost', {
    headers: {
      'user-agent': ua,
      'x-forwarded-for': ip,
    },
  })
}

describe('handleDeviceFingerprint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores a new fingerprint for a brand‑new device', async () => {
    mockFindUnique.mockResolvedValue({ knownDevices: null, lastLoginAt: null })
    mockUpdate.mockResolvedValue({})

    await handleDeviceFingerprint(
      makeRequest('Mozilla/5.0', '1.2.3.4'),
      'user-1',
      'Alice',
      'alice@example.com',
      1
    )

    expect(mockUpdate).toHaveBeenCalledTimes(1)
    const updateArg = mockUpdate.mock.calls[0][0]
    expect(updateArg.data.knownDevices).toBeTruthy()
  })

  it('produces the same fingerprint for identical UA + IP', async () => {
    const results: string[] = []

    for (let i = 0; i < 2; i++) {
      mockFindUnique.mockResolvedValue({ knownDevices: null, lastLoginAt: null })
      mockUpdate.mockResolvedValue({})

      await handleDeviceFingerprint(
        makeRequest('Chrome/100', '10.0.0.1'),
        `user-${i}`,
        'Bob',
        'bob@example.com',
        1
      )

      const calls = mockUpdate.mock.calls
      const stored = JSON.parse(calls[calls.length - 1][0].data.knownDevices)
      results.push(stored[0])
      vi.clearAllMocks()
    }

    expect(results[0]).toBe(results[1])
  })

  it('produces different fingerprints for different UA', async () => {
    const fingerprints: string[] = []

    for (const ua of ['Firefox/99', 'Safari/15']) {
      mockFindUnique.mockResolvedValue({ knownDevices: null, lastLoginAt: null })
      mockUpdate.mockResolvedValue({})

      await handleDeviceFingerprint(
        makeRequest(ua, '10.0.0.1'),
        'user-x',
        'Carol',
        'carol@example.com',
        1
      )

      const calls = mockUpdate.mock.calls
      const stored = JSON.parse(calls[calls.length - 1][0].data.knownDevices)
      fingerprints.push(stored[0])
      vi.clearAllMocks()
    }

    expect(fingerprints[0]).not.toBe(fingerprints[1])
  })

  it('keeps at most 10 known devices', async () => {
    const existingDevices = Array.from({ length: 10 }, (_, i) => `hash-${i}`)
    mockFindUnique.mockResolvedValue({
      knownDevices: JSON.stringify(existingDevices),
      lastLoginAt: new Date(0),
    })
    mockUpdate.mockResolvedValue({})

    await handleDeviceFingerprint(
      makeRequest('NewBrowser/1.0', '99.99.99.99'),
      'user-z',
      'Dave',
      'dave@example.com',
      1
    )

    const calls = mockUpdate.mock.calls
    const updated = JSON.parse(calls[0][0].data.knownDevices)
    expect(updated).toHaveLength(10)
  })
})
