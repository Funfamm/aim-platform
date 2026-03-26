/**
 * Ensure superadmin exists — creates or promotes the account.
 * Run: node prisma/ensure-superadmin.mjs
 */
import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env manually
try {
  const env = readFileSync(join(__dirname, '../.env'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
  }
} catch {}

const prisma = new PrismaClient()

const EMAIL = 'aimstudio@impactaistudio.com'
const NAME = 'AIM Studio Admin'
const PASSWORD = 'Impactmedia@1011'

// Use bcrypt-compatible hash via the API — since bcrypt isn't available in ESM directly,
// we'll use a simple approach: call the hash via dynamic import
async function hashPassword(password) {
  const { hash } = await import('bcryptjs')
  return hash(password, 12)
}

async function main() {
  console.log(`\n🔍 Checking for superadmin: ${EMAIL}`)

  let user = await prisma.user.findUnique({ where: { email: EMAIL } })

  if (!user) {
    console.log('   ➕ User not found — creating new superadmin account...')
    const passwordHash = await hashPassword(PASSWORD)
    user = await prisma.user.create({
      data: {
        email: EMAIL,
        name: NAME,
        passwordHash,
        role: 'superadmin',
        emailVerified: true,
        tokenVersion: 0,
      },
    })
    console.log(`   ✅ Created superadmin: ${user.name} (${user.email})`)
  } else {
    console.log(`   Found: ${user.name} — role: ${user.role}`)
    if (user.role !== 'superadmin') {
      await prisma.user.update({ where: { id: user.id }, data: { role: 'superadmin', emailVerified: true } })
      console.log('   ✅ Promoted to superadmin')
    } else {
      console.log('   ✅ Already a superadmin — no changes needed')
    }
  }

  // Also ensure SiteSettings default row exists
  const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } })
  if (!settings) {
    await prisma.siteSettings.create({ data: { id: 'default' } })
    console.log('   ✅ Created default SiteSettings row')
  } else {
    console.log('   ✅ SiteSettings row exists')
  }
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
