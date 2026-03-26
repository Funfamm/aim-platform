/**
 * Seed Superadmin — Promote an existing user to superadmin
 *
 * Usage:
 *   npx tsx prisma/seed-superadmin.ts your@email.com
 */

import { PrismaClient } from '@prisma/client'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config()

function getDbPath(): string {
    const url = process.env.DATABASE_URL || 'file:./prisma/dev.db'
    const filePath = url.replace(/^file:/, '')
    if (path.isAbsolute(filePath)) return filePath
    return path.join(process.cwd(), filePath)
}

// Standard Prisma client — no driver adapter needed (uses DATABASE_URL env var)
// Set DATABASE_URL=file:./prisma/dev.db in your .env
const dbPath = getDbPath()
process.env.DATABASE_URL = `file:${dbPath}`
const prisma = new PrismaClient()

async function main() {
    const email = process.argv[2]

    if (!email) {
        console.error('❌ Usage: npx tsx prisma/seed-superadmin.ts <email>')
        console.error('   Example: npx tsx prisma/seed-superadmin.ts admin@aim.com')
        process.exit(1)
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
        console.error(`❌ No user found with email: ${email}`)
        console.error('   Register the user first, then run this command.')
        process.exit(1)
    }

    if (user.role === 'superadmin') {
        console.log(`✅ ${user.name} (${user.email}) is already a superadmin.`)
        process.exit(0)
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { role: 'superadmin' },
    })

    console.log(`✅ ${user.name} (${user.email}) has been promoted to superadmin!`)
    console.log('   They can now log in at /login and will be redirected to /admin.')
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
