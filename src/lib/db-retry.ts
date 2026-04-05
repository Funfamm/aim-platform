import { logger } from '@/lib/logger'

/**
 * Executes a database query with exponential backoff retries.
 * Prevents 500 errors when pulling from a cold-start/scale-to-zero database (like Neon Free Tier).
 */
export async function withDbRetry<T>(
    operation: () => Promise<T>,
    context: string = 'db_operation',
    maxRetries: number = 3,
    baseDelayMs: number = 1000
): Promise<T> {
    let attempt = 0
    while (true) {
        try {
            return await operation()
        } catch (error) {
            attempt++
            if (attempt > maxRetries) {
                logger.error('db-retry', `Operation '${context}' failed after ${maxRetries} attempts`, { error })
                throw error
            }
            logger.warn('db-retry', `Operation '${context}' failed, retrying (${attempt}/${maxRetries})...`, { error: (error as Error).message })
            const delay = baseDelayMs * Math.pow(2, attempt - 1)
            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }
}
