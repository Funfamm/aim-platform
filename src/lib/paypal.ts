/**
 * src/lib/paypal.ts — Shared PayPal utility module.
 *
 * DRY: Both donation and project-payment routes import from here
 * instead of duplicating config + token logic.
 *
 * Environment:
 *   PAYPAL_MODE / NEXT_PUBLIC_PAYPAL_MODE  — 'sandbox' | 'live'
 *   NEXT_PUBLIC_PAYPAL_CLIENT_ID           — live client ID (also used by SDK)
 *   NEXT_PUBLIC_PAYPAL_SANDBOX_CLIENT_ID   — sandbox client ID
 *   PAYPAL_SECRET                          — live secret
 *   PAYPAL_SANDBOX_SECRET                  — sandbox secret
 */

export const IS_SANDBOX =
    process.env.PAYPAL_MODE === 'sandbox' ||
    process.env.NEXT_PUBLIC_PAYPAL_MODE === 'sandbox'

export const PAYPAL_API = IS_SANDBOX
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'

export const PAYPAL_CLIENT_ID = IS_SANDBOX
    ? process.env.NEXT_PUBLIC_PAYPAL_SANDBOX_CLIENT_ID!
    : (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID)!

const PAYPAL_SECRET = IS_SANDBOX
    ? process.env.PAYPAL_SANDBOX_SECRET!
    : process.env.PAYPAL_SECRET!

/**
 * Obtain an OAuth2 access token from PayPal.
 * Tokens are short-lived (~9 hours) — callers should NOT cache across requests.
 */
export async function getPayPalAccessToken(): Promise<string> {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`).toString('base64')
    const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    })
    const data = await res.json()
    if (!data.access_token) {
        throw new Error('Failed to get PayPal access token')
    }
    return data.access_token
}

/**
 * Create a PayPal checkout order.
 */
export async function createPayPalOrder(opts: {
    amount: number
    currency?: string
    description: string
    customId: string
    brandName?: string
}): Promise<{ orderId: string; approveUrl: string }> {
    const accessToken = await getPayPalAccessToken()
    const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            intent: 'CAPTURE',
            purchase_units: [
                {
                    custom_id: opts.customId,
                    description: opts.description,
                    amount: {
                        currency_code: opts.currency || 'USD',
                        value: opts.amount.toFixed(2),
                    },
                },
            ],
            application_context: {
                brand_name: opts.brandName || 'AIM Studio',
                shipping_preference: 'NO_SHIPPING',
                user_action: 'PAY_NOW',
            },
        }),
    })

    const data = await res.json()
    if (!res.ok) {
        console.error('[paypal] Create order failed:', data)
        throw new Error('Failed to create PayPal order')
    }

    const approveLink = data.links?.find((l: { rel: string; href: string }) => l.rel === 'approve')
    return {
        orderId: data.id,
        approveUrl: approveLink?.href || '',
    }
}

/**
 * Capture a previously approved PayPal order.
 */
export async function capturePayPalOrder(orderId: string): Promise<{
    status: string
    captureId: string | null
    customId: string | null
    amount: number | null
    declineReason: string | null
}> {
    const accessToken = await getPayPalAccessToken()
    const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
    })

    const data = await res.json()

    // Extract decline/error details from PayPal response
    if (!res.ok || data.status !== 'COMPLETED') {
        console.error('[paypal] Capture failed:', JSON.stringify(data, null, 2))

        // PayPal returns structured error details
        const issue = data.details?.[0]?.issue || data.name || ''
        const description = data.details?.[0]?.description || data.message || ''

        // Also check capture-level status for processor declines
        const captureStatus = data.purchase_units?.[0]?.payments?.captures?.[0]?.status
        const processorResponse = data.purchase_units?.[0]?.payments?.captures?.[0]?.processor_response

        let reason = 'Payment could not be processed'
        if (issue === 'INSTRUMENT_DECLINED' || description.includes('insufficient')) {
            reason = 'Your payment method was declined. Please check your balance or try a different payment method.'
        } else if (issue === 'PAYER_ACTION_REQUIRED') {
            reason = 'Additional verification is required by your bank. Please try again.'
        } else if (issue === 'ORDER_NOT_APPROVED') {
            reason = 'The payment was not approved. Please try again.'
        } else if (issue === 'DUPLICATE_INVOICE_ID') {
            reason = 'This payment has already been processed.'
        } else if (processorResponse?.response_code === '5400') {
            reason = 'Insufficient funds. Please try a different payment method.'
        } else if (description) {
            reason = description
        }

        const err = new Error(reason)
        ;(err as Error & { paypalIssue?: string }).paypalIssue = issue
        throw err
    }

    const pu = data.purchase_units?.[0]
    const capture = pu?.payments?.captures?.[0]

    return {
        status: data.status,
        captureId: capture?.id || null,
        customId: pu?.custom_id || null,
        amount: capture?.amount?.value ? parseFloat(capture.amount.value) : null,
        declineReason: null,
    }
}

// ── Milestone split calculation ──────────────────────────────────────────────

export const MILESTONE_SPLITS = {
    deposit: 0.4,
    midpoint: 0.3,
    final: 0.3,
} as const

export type MilestoneType = keyof typeof MILESTONE_SPLITS

export function calculateMilestoneAmount(
    total: number,
    milestone: MilestoneType,
): number {
    return Math.round(total * MILESTONE_SPLITS[milestone] * 100) / 100
}
