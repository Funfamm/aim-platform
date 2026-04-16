/**
 * src/lib/translators/registry.ts — Translator provider registry (DIP / OCP fix).
 *
 * Previously subtitle-service.ts imported GeminiTranslator directly at module level,
 * creating a hard concrete dependency even when a different ITranslator was injected.
 *
 * This registry is the single binding point between the high-level service
 * and the concrete provider. subtitle-service.ts imports only ITranslator and
 * getTranslator() — it never sees the concrete class.
 *
 * OCP: swapping providers platform-wide = call registerTranslator() once at startup.
 * Testability: tests call registerTranslator(mockTranslator) before running.
 */

import { geminiTranslator } from '@/lib/translators/GeminiTranslator'
import type { ITranslator } from '@/lib/interfaces/ITranslator'

/** The active provider. Defaults to GeminiTranslator. */
let _active: ITranslator = geminiTranslator

/**
 * Returns the currently registered translation provider.
 * Called by subtitle-service.ts as the default for translateTextsForLang.
 */
export function getTranslator(): ITranslator {
    return _active
}

/**
 * Register a different translation provider platform-wide.
 *
 * Call once at startup (e.g. in next.config.ts or an initialiser) or in tests.
 * All subsequent calls to translateTextsForLang will use the new provider
 * unless a specific provider is injected per-call.
 *
 * @example (test)
 *   registerTranslator(new MockTranslator())
 */
export function registerTranslator(translator: ITranslator): void {
    _active = translator
}
