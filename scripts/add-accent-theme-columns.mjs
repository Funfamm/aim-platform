/**
 * Add accentColor and themeMode columns to the User table.
 * Safe to run multiple times — uses IF NOT EXISTS.
 *
 * Run: node scripts/add-accent-theme-columns.mjs
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // Add accentColor column (default 'gold')
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "accentColor" TEXT NOT NULL DEFAULT 'gold'
    `)
    console.log('✅ accentColor column added')

    // Add themeMode column (default 'dark')
    await prisma.$executeRawUnsafe(`
        ALTER TABLE "User"
        ADD COLUMN IF NOT EXISTS "themeMode" TEXT NOT NULL DEFAULT 'dark'
    `)
    console.log('✅ themeMode column added')
}

main()
    .then(() => { console.log('Done!'); process.exit(0) })
    .catch(e => { console.error(e); process.exit(1) })
