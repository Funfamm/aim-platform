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
  const { name, currentPassword, newPassword } = body

  const user = await prisma.user.findUnique({
    where: { id: session.userId as string },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const updateData: { name?: string; passwordHash?: string; tokenVersion?: { increment: number } } = {}

  if (name && name.trim()) {
    updateData.name = name.trim()
  }

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 })
    }
    if (!user.passwordHash) {
      return NextResponse.json({ error: 'Cannot change password for OAuth accounts' }, { status: 400 })
    }
    const valid = await compare(currentPassword, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
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
