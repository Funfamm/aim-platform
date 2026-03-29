import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const EMAIL = 'aimstudio@impactaistudio.com'
const PASSWORD = 'Goodness@1011'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash(PASSWORD, 12)

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      role: 'superadmin',
      emailVerified: true,
      passwordHash: hashedPassword,
    },
    create: {
      name: 'Super Admin',
      email: EMAIL,
      passwordHash: hashedPassword,
      role: 'superadmin',
      emailVerified: true,
    },
  })

  console.log(`✅ Super admin ready:`, {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
  })
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
