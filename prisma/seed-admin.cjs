const { PrismaClient } = require('.prisma/client')
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
const bcrypt = require('bcryptjs')
const path = require('path')

const dbPath = path.join(__dirname, 'dev.db')
const adapter = new PrismaBetterSqlite3({ url: dbPath })
const prisma = new PrismaClient({ adapter })

async function seedAdmin() {
    console.log('Creating superadmin user...')
    const passwordHash = await bcrypt.hash('Goodness@1011', 12)
    const user = await prisma.user.upsert({
        where: { email: 'aimstudio@impactaistudio.com' },
        update: { passwordHash, role: 'superadmin' },
        create: {
            email: 'aimstudio@impactaistudio.com',
            passwordHash,
            name: 'Super Admin',
            role: 'superadmin',
            tokenVersion: 0,
            emailVerified: true,
        },
    })
    console.log('Superadmin created:', user.id, user.email, user.role)
}

seedAdmin()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())
