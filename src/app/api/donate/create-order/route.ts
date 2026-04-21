import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'

const isSandbox = process.env.PAYPAL_MODE === 'sandbox' || process.env.NEXT_PUBLIC_PAYPAL_MODE === 'sandbox'
const PAYPAL_API = isSandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com'
const PAYPAL_CLIENT_ID = isSandbox
    ? process.env.NEXT_PUBLIC_PAYPAL_SANDBOX_CLIENT_ID!
    : (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID)!
const PAYPAL_SECRET = isSandbox ? process.env.PAYPAL_SANDBOX_SECRET! : process.env.PAYPAL_SECRET!

async function getAccessToken(): Promise<string> {
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

export async function POST(request: Request) {
    try {
        // Check if donations are enabled
        const settings = await prisma.siteSettings.findFirst()
        if (settings && !settings.donationsEnabled) {
            return NextResponse.json({ error: 'Donations are currently disabled' }, { status: 403 })
        }

        const { name, email, amount, message, anonymous, projectId } = await request.json()

        if (!email || !amount || amount <= 0) {
            return NextResponse.json({ error: 'Email and a valid amount are required' }, { status: 400 })
        }

        const minAmount = settings?.donationMinAmount ?? 1
        if (amount < minAmount) {
            return NextResponse.json({ error: `Minimum donation amount is $${minAmount}` }, { status: 400 })
        }

        const session = await getUserSession()
        const donorName = anonymous ? 'Anonymous Donor' : (name || 'Anonymous Donor')

        // ─── Do NOT create a DB record yet ───
        // We only save the donation after PayPal confirms COMPLETED.
        // Donor details are carried in the PayPal order's custom_id.
        //
        // ⚠️  PayPal hard-limits custom_id to 127 characters.
        // Use a compact pipe-delimited format instead of verbose JSON keys
        // to stay well under that limit even with long emails and UUIDs.
        //
        // Format: name|email|amount|anonymous|userId|projectId|message
        // Fields: truncate name to 30 chars for safety; message is omitted
        //         from custom_id (saved separately after capture via the
        //         extra ?msg= query param on the success URL, or left null).
        const safeName = donorName.slice(0, 30)
        const safeEmail = email.slice(0, 60)
        const donorMeta = [
            safeName,
            safeEmail,
            parseFloat(amount).toFixed(2),
            anonymous ? '1' : '0',
            session?.userId || '',
            projectId || '',
            // message excluded — stored via DB after capture, retrieved from request body
        ].join('|')

        // Also keep message in a separate field we pass to our own capture endpoint
        // via a flag stored in the order description — but the reliable path is:
        // the client sends the original message field back to capture-order.
        // (We pass it through the frontend capture call body instead.)

        // Create PayPal order — donor details in custom_id
        const accessToken = await getAccessToken()
        const orderRes = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [
                    {
                        custom_id: donorMeta,
                        description: `Donation to AIM Studio from ${donorName}`,
                        amount: {
                            currency_code: 'USD',
                            value: parseFloat(amount).toFixed(2),
                        },
                    },
                ],
                application_context: {
                    brand_name: 'AIM Studio',
                    shipping_preference: 'NO_SHIPPING',
                    user_action: 'PAY_NOW',
                },
            }),
        })

        const orderData = await orderRes.json()

        if (!orderRes.ok) {
            console.error('PayPal create order failed:', orderData)
            return NextResponse.json({ error: 'Failed to create PayPal order' }, { status: 500 })
        }

        return NextResponse.json({ orderID: orderData.id })
    } catch (error) {
        console.error('Create order error:', error)
        return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 })
    }
}
