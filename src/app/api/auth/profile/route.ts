import { NextResponse } from 'next/server'
import { getUserSession, createToken, createRefreshToken, setUserCookie } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { hash, compare } from 'bcryptjs'

export async function PUT(request: Request) {
  const session = await getUserSession()
  if (!session?.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, currentPassword, newPassword, accentColor, themeMode } = body

  const user = await prisma.user.findUnique({
    where: { id: session.userId as string },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const updateData: { name?: string; passwordHash?: string; tokenVersion?: { increment: number }; accentColor?: string; themeMode?: string } = {}

  if (name && name.trim()) {
    updateData.name = name.trim()
  }

  const VALID_ACCENTS = ['gold', 'silver', 'ember', 'jade', 'azure']
  if (accentColor && VALID_ACCENTS.includes(accentColor)) {
    updateData.accentColor = accentColor
  }
  const VALID_THEMES = ['dark', 'light']
  if (themeMode && VALID_THEMES.includes(themeMode)) {
    updateData.themeMode = themeMode
  }

  // How many recent passwords to check against (matches forgot-password route)
  const PASSWORD_HISTORY_LIMIT = 5

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'ERR_CURRENT_REQUIRED' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'ERR_PW_TOO_SHORT' }, { status: 400 })
    }
    if (!user.passwordHash) {
      return NextResponse.json({ error: 'ERR_OAUTH_NO_PASSWORD' }, { status: 400 })
    }
    const valid = await compare(currentPassword, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'ERR_CURRENT_INCORRECT' }, { status: 400 })
    }

    // ── Password reuse check (same rules as forgot-password) ──
    // Check against current password
    const sameAsCurrent = await compare(newPassword, user.passwordHash)
    if (sameAsCurrent) {
      return NextResponse.json({ error: 'ERR_SAME_PASSWORD' }, { status: 400 })
    }

    // Check against recent password history
    const recentPasswords = await prisma.passwordHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: PASSWORD_HISTORY_LIMIT,
    })

    for (const entry of recentPasswords) {
      const matchesOld = await compare(newPassword, entry.passwordHash)
      if (matchesOld) {
        return NextResponse.json({ error: 'ERR_REUSED_PASSWORD' }, { status: 400 })
      }
    }

    // ── Save current password to history before changing ──
    await prisma.passwordHistory.create({
      data: { userId: user.id, passwordHash: user.passwordHash },
    })

    // Clean up old entries — keep only the last N
    const allHistory = await prisma.passwordHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    if (allHistory.length > PASSWORD_HISTORY_LIMIT) {
      const toDelete = allHistory.slice(PASSWORD_HISTORY_LIMIT).map((h: { id: string }) => h.id)
      await prisma.passwordHistory.deleteMany({
        where: { id: { in: toDelete } },
      })
    }

    updateData.passwordHash = await hash(newPassword, 12)
    updateData.tokenVersion = { increment: 1 }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: session.userId as string },
    data: updateData,
    select: { id: true, name: true, email: true, avatar: true, role: true },
  })

  if (updateData.name || updateData.tokenVersion) {
    // Fetch tokenVersion via raw query (not yet in generated types)
    const tvRows = await prisma.$queryRaw<{ tokenVersion: number }[]>`SELECT "tokenVersion" FROM "User" WHERE "id" = ${updated.id}`
    const tokenVersion = tvRows[0]?.tokenVersion ?? 0
    const tokenPayload = {
      userId: updated.id,
      role: updated.role,
      email: updated.email,
      tokenVersion,
    }
    const token = await createToken(tokenPayload)
    const refresh = await createRefreshToken(tokenPayload)
    await setUserCookie(token, refresh)
  }

  return NextResponse.json({ user: updated })
}
