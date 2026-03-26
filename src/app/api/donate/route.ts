import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { sendEmail } from '@/lib/mailer'
import { donationThankYouWithOverrides, donationAdminNotification } from '@/lib/email-templates'

export async function POST(request: Request) {
    try {
        // Check if donations are enabled
        const settings = await prisma.siteSettings.findFirst()
        if (settings && !settings.donationsEnabled) {
            return NextResponse.json({ error: 'Donations are currently disabled' }, { status: 403 })
        }

        const { name, email, amount, message, anonymous } = await request.json()

        if (!email || !amount || amount <= 0) {
            return NextResponse.json({ error: 'Email and a valid amount are required' }, { status: 400 })
        }

        // Enforce minimum donation amount from settings
        const minAmount = settings?.donationMinAmount ?? 1
        if (amount < minAmount) {
            return NextResponse.json({ error: `Minimum donation amount is $${minAmount}` }, { status: 400 })
        }

        const session = await getUserSession()
        const donorName = anonymous ? 'Anonymous Donor' : (name || 'Anonymous Donor')

        const donation = await prisma.donation.create({
            data: {
                name: donorName,
                email,
                amount: parseFloat(amount),
                message: message || null,
                anonymous: anonymous ?? false,
                userId: session?.userId as string | undefined,
                status: 'completed',
            },
        })

        // Fire-and-forget: thank-you receipt to donor
        sendEmail({
            to: email,
            subject: `Thank you for your $${parseFloat(amount).toFixed(2)} donation! 💛`,
            html: await donationThankYouWithOverrides(donorName, parseFloat(amount)),
        })

        // Fire-and-forget: notify admin
        if (settings?.notifyOnDonation) {
            const adminEmail = settings.notifyEmail || settings.contactEmail
            if (adminEmail) {
                sendEmail({
                    to: adminEmail,
                    subject: `💰 New Donation: $${parseFloat(amount).toFixed(2)} from ${donorName}`,
                    html: donationAdminNotification(donorName, email, parseFloat(amount)),
                })
            }
        }

        return NextResponse.json({
            success: true,
            donation: { id: donation.id, amount: donation.amount, createdAt: donation.createdAt },
        })
    } catch (error) {
        console.error('Donation error:', error)
        return NextResponse.json({ error: 'Failed to process donation' }, { status: 500 })
    }
}
