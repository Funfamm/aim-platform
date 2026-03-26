import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const EMAIL = 'aimstudio@impactaistudio.com'
const PASSWORD = 'Goodness@1011??'

async function main() {
  // Check if user exists
  const existing = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, email: true, role: true, emailVerified: true, name: true }
  })

  console.log('Existing user:', JSON.stringify(existing, null, 2))

  const hashedPassword = await bcrypt.hash(PASSWORD, 12)

  if (existing) {
    // Update: set role to superadmin, emailVerified to true, and update password
    const updated = await prisma.user.update({
      where: { email: EMAIL },
      data: {
        role: 'superadmin',
        emailVerified: true,
        passwordHash: hashedPassword,
      },
      select: { id: true, email: true, role: true, emailVerified: true }
    })
    console.log('✅ Updated user:', JSON.stringify(updated, null, 2))
  } else {
    // Create new superadmin user
    const created = await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: EMAIL,
        passwordHash: hashedPassword,
        role: 'superadmin',
        emailVerified: true,
      },
      select: { id: true, email: true, role: true, emailVerified: true }
    })
    console.log('✅ Created user:', JSON.stringify(created, null, 2))
  }
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
