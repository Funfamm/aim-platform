import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createToken, createRefreshToken, setUserCookie } from '@/lib/auth'
import { cookies } from 'next/headers'
import * as jose from 'jose'

export async function POST(req: Request) {
    const formData = await req.formData()
    const code = formData.get('code') as string | null
    const idToken = formData.get('id_token') as string | null
    const userDataStr = formData.get('user') as string | null

    if (!code && !idToken) {
        return NextResponse.redirect(new URL('/login?error=no_code', req.url))
    }

    try {
        const settings = await prisma.siteSettings.findFirst()
        const s = settings as Record<string, string> | null
        const clientId = s?.appleClientId || ''
        const teamId = s?.appleTeamId || ''
        const keyId = s?.appleKeyId || ''
        const privateKey = s?.applePrivateKey || ''

        if (!clientId || !teamId || !keyId || !privateKey) {
            return NextResponse.redirect(new URL('/login?error=apple_not_configured', req.url))
        }

        let appleUserId = ''
        let email = ''
        let name = ''

        // Decode the id_token to get user info
        if (idToken) {
            const decoded = jose.decodeJwt(idToken)
            appleUserId = decoded.sub || ''
            email = (decoded.email as string) || ''
        }

        // Apple sends user data only on first authorization
        if (userDataStr) {
            try {
                const userData = JSON.parse(userDataStr)
                if (userData.name) {
                    name = `${userData.name.firstName || ''} ${userData.name.lastName || ''}`.trim()
                }
                if (userData.email) email = userData.email
            } catch { /* ignore parse errors */ }
        }

        if (!appleUserId) {
            return NextResponse.redirect(new URL('/login?error=apple_user_failed', req.url))
        }

        // Find or create user
        let user = await prisma.user.findFirst({
            where: {
                OR: [
                    { appleId: appleUserId },
                    ...(email ? [{ email }] : []),
                ],
            },
        })

        if (user) {
            if (!user.appleId) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { appleId: appleUserId },
                })
            }
        } else {
            user = await prisma.user.create({
                data: {
                    name: name || 'Apple User',
                    email: email || `apple_${appleUserId}@private.appleid.com`,
                    appleId: appleUserId,
                    role: 'member',
                },
            })
        }

        // Block admin/superadmin from using OAuth — they must log in with email + password
        if (user.role === 'admin' || user.role === 'superadmin') {
            return NextResponse.redirect(new URL('/login?error=admin_oauth_disallowed', req.url))
        }

        // Create session tokens
        const tokenPayload = {
            userId: user.id,
            role: user.role,
            email: user.email,
        }
        const token = await createToken(tokenPayload)
        const refresh = await createRefreshToken(tokenPayload)
        await setUserCookie(token, refresh)

        return NextResponse.redirect(new URL('/dashboard', req.url))
    } catch {
        return NextResponse.redirect(new URL('/login?error=apple_failed', req.url))
    }
}
