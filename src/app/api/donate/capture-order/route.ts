import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendEmail } from '@/lib/mailer'
import { donationThankYouWithOverrides, donationAdminNotification } from '@/lib/email-templates'
import { mirrorToNotificationBoard } from '@/lib/notifications'
import { t as emailT } from '@/lib/email-i18n'

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
        const body = await request.json()
        const { orderID, message: clientMessage } = body

        if (!orderID) {
            return NextResponse.json({ error: 'Missing orderID' }, { status: 400 })
        }

        const accessToken = await getAccessToken()

        // Capture the PayPal order
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
            return NextResponse.json({ error: 'Payment capture failed' }, { status: 500 })
        }

        // Extract donor metadata from PayPal's custom_id
        // Format (pipe-delimited, <127 chars): name|email|amount|anonymous|userId|projectId
        const customId = captureData.purchase_units?.[0]?.custom_id
        if (!customId) {
            console.error('[capture-order] Missing custom_id in capture response. PayPal likely truncated it (>127 chars).')
            return NextResponse.json({ error: 'Could not retrieve donation details from payment' }, { status: 500 })
        }

        let donorMeta: {
            name: string; email: string; amount: number; message: string | null;
            anonymous: boolean; userId: string | null; projectId: string | null;
        }
        try {
            const parts = customId.split('|')
            if (parts.length < 4) throw new Error('Too few fields')
            donorMeta = {
                name:      parts[0] || 'Anonymous Donor',
                email:     parts[1] || '',
                amount:    parseFloat(parts[2]),
                anonymous: parts[3] === '1',
                userId:    parts[4] || null,
                projectId: parts[5] || null,
                message:   clientMessage || null,   // sent by client in the capture request body
            }
            if (!donorMeta.email || isNaN(donorMeta.amount)) throw new Error('Invalid fields')
        } catch (parseErr) {
            console.error('[capture-order] Failed to parse custom_id:', customId, parseErr)
            return NextResponse.json({ error: 'Could not parse donation details' }, { status: 500 })
        }

        // ─── Only NOW create the donation record — transaction is confirmed COMPLETED ───
        const donation = await prisma.donation.create({
            data: {
                name: donorMeta.name,
                email: donorMeta.email,
                amount: donorMeta.amount,
                message: donorMeta.message,
                anonymous: donorMeta.anonymous,
                userId: donorMeta.userId ?? undefined,
                projectId: donorMeta.projectId ?? undefined,
                method: 'paypal',
                status: 'completed',
            },
        })

        console.log(`✅ Donation ${donation.id} saved — $${donation.amount} from ${donation.name}`)

        // Look up user's preferred locale for localized messages
        const donorUser = donorMeta.userId
            ? await prisma.user.findUnique({
                where: { id: donorMeta.userId },
                select: { id: true, preferredLanguage: true },
            })
            : await prisma.user.findUnique({
                where: { email: donorMeta.email },
                select: { id: true, preferredLanguage: true },
            })
        const locale = donorUser?.preferredLanguage || 'en'

        const emailSubject = emailT('donationThankYou', locale, 'subject')
            || `Thank you for your $${donation.amount.toFixed(2)} donation! 💛`

        sendEmail({
            to: donation.email,
            subject: emailSubject,
            html: await donationThankYouWithOverrides(donation.name, donation.amount, undefined, locale),
        }).catch(err => console.error('Failed to send thank-you email:', err))

        // Mirror to notification board if donor has an account
        if (donorUser) {
            const notifTitle = emailT('donationThankYou', locale, 'notifTitle')
                || `Donation Received 💛`
            const notifBody = emailT('donationThankYou', locale, 'notifBody')
                || `Thank you for your generous $${donation.amount.toFixed(2)} donation! Your support makes a real difference.`
            void mirrorToNotificationBoard(
                donorUser.id,
                'system',
                `${notifTitle} $${donation.amount.toFixed(2)}`,
                notifBody,
                '/dashboard',
                `donation-confirm-${donation.id}`,
            ).catch(() => { /* non-critical */ })
        }

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
