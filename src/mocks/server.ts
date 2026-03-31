/**
 * MSW Server — use in Vitest (Node.js environment)
 *
 * Import this in vitest.setup.ts or individual test files:
 *   import { server } from '@/mocks/server'
 *   beforeAll(() => server.listen())
 *   afterEach(() => server.resetHandlers())
 *   afterAll(() => server.close())
 */

import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
