/**
 * src/lib/prisma-utils.ts — Shared Prisma helper utilities (DRY / DIP fix).
 *
 * Previously `toJson` was defined independently in BOTH subtitle-repo.ts and
 * subtitle-status-service.ts. Two identical private definitions created a risk
 * of silent divergence if one was updated and the other wasn't.
 *
 * This module is the single source of truth for all Prisma-specific casting.
 * Both files import from here — if the cast logic ever changes, it changes once.
 */

import { Prisma } from '@prisma/client'

/**
 * Cast a plain object to Prisma.InputJsonValue.
 *
 * Prisma Json? fields do not accept typed TS objects directly — they require
 * an explicit cast. This utility provides the canonical cast in one place.
 *
 * @example
 *   langStatus: toJson(myRecord)
 */
export function toJson<T extends object>(value: T): Prisma.InputJsonValue {
    return value as unknown as Prisma.InputJsonValue
}
