import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { donationThankYouWithOverrides, donationAdminNotification } from '@/lib/email-templates'

const PAYPAL_API = 'https://api-m.paypal.com'
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID!
const PAYPAL_SECRET = process.env.PAYPAL_SECRET!

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
        const { orderID } = await request.json()

        if (!orderID) {
            return NextResponse.json({ error: 'Missing orderID' }, { status: 400 })
        }

        // First, get order details to find the donationId from reference_id
        const accessToken = await getAccessToken()
        const orderRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        })
        const orderData = await orderRes.json()
        const donationId = orderData.purchase_units?.[0]?.reference_id

        if (!donationId) {
            return NextResponse.json({ error: 'Could not find donation record' }, { status: 400 })
        }


        // Capture the PayPal order (reuse accessToken from above)
        const captureRes = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
        })

        const captureData = await captureRes.json()

        if (!captureRes.ok || captureData.status !== 'COMPLETED') {
            console.error('PayPal capture failed:', captureData)
            // Mark donation as failed
            await prisma.donation.update({
                where: { id: donationId },
                data: { status: 'failed' },
            })
            return NextResponse.json({ error: 'Payment capture failed' }, { status: 500 })
        }

        // Update donation to completed
        const donation = await prisma.donation.update({
            where: { id: donationId },
            data: { status: 'completed' },
        })

        console.log(`✅ Donation ${donationId} completed via PayPal — $${donation.amount}`)

        // Send thank-you email to donor
        sendEmail({
            to: donation.email,
            subject: `Thank you for your $${donation.amount.toFixed(2)} donation! 💛`,
            html: await donationThankYouWithOverrides(donation.name, donation.amount),
        }).catch(err => console.error('Failed to send thank-you email:', err))

        // Notify admin
        const settings = await prisma.siteSettings.findFirst()
        if (settings?.notifyOnDonation) {
            const adminEmail = settings.notifyEmail || settings.contactEmail
            if (adminEmail) {
                sendEmail({
                    to: adminEmail,
                    subject: `💰 New Donation: $${donation.amount.toFixed(2)} from ${donation.name}`,
                    html: donationAdminNotification(donation.name, donation.email, donation.amount),
                }).catch(err => console.error('Failed to send admin notification:', err))
            }
        }

        return NextResponse.json({
            success: true,
            donation: { id: donation.id, amount: donation.amount, createdAt: donation.createdAt },
        })
    } catch (error) {
        console.error('Capture order error:', error)
        return NextResponse.json({ error: 'Failed to capture payment' }, { status: 500 })
    }
}
