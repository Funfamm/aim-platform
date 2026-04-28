/**
 * Transport Resolver
 * ---------------------------------------------------------------------------
 * Resolves which email transport to use for a given email type.
 *
 * Transport paths:
 *   - Transactional emails → always Graph/SMTP (admin-configured primary transport)
 *   - Bulk emails → routed per bulkTransport setting: 'graph' | 'smtp' | 'acs'
 *
 * ACS is never used for transactional — it doesn't support the
 * individual-send latency and error semantics required for auth emails.
 */
import { prisma } from '@/lib/db'
import { decrypt } from '@/lib/secure'
import { logger } from '@/lib/logger'

export interface BulkTransportConfig {
    transport: 'graph' | 'smtp' | 'acs'
    // ACS-specific fields (only present when transport === 'acs')
    acsConnectionString?: string
    acsSenderAddress?: string
}

/**
 * Get the admin-configured bulk transport setting.
 *
 * @returns BulkTransportConfig with transport type and ACS credentials if applicable
 * @throws Error if ACS is selected but not fully configured
 */
export async function getBulkTransportConfig(): Promise<BulkTransportConfig> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const settings = await (prisma.siteSettings as any).findFirst({
            select: {
                bulkTransport: true,
                acsConnectionString: true,
                acsSenderAddress: true,
            },
        })

        const transport = (settings?.bulkTransport as 'graph' | 'smtp' | 'acs') || 'graph'

        if (transport === 'acs') {
            if (!settings?.acsConnectionString || !settings?.acsSenderAddress) {
                logger.error('transport-resolver', 'ACS selected as bulk transport but credentials are incomplete')
                throw new Error(
                    'ACS is selected as bulk transport but is not fully configured. ' +
                    'Please configure the ACS Connection String and Sender Address in admin settings.'
                )
            }

            return {
                transport: 'acs',
                acsConnectionString: decrypt(settings.acsConnectionString),
                acsSenderAddress: settings.acsSenderAddress,
            }
        }

        return { transport }
    } catch (err) {
        // If it's our own config error, rethrow
        if (err instanceof Error && err.message.includes('ACS is selected')) throw err

        logger.error('transport-resolver', 'Failed to resolve bulk transport config', { error: err as Error })
        // Fallback to graph on config errors — safer than crashing
        return { transport: 'graph' }
    }
}

/**
 * Check if ACS transport is available (credentials configured).
 * Used by settings UI to show/hide warnings.
 */
export async function isAcsConfigured(): Promise<boolean> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const settings = await (prisma.siteSettings as any).findFirst({
            select: { acsConnectionString: true, acsSenderAddress: true },
        })
        return !!(settings?.acsConnectionString && settings?.acsSenderAddress)
    } catch {
        return false
    }
}
