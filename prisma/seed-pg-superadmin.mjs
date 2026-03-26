/**
 * Seeds a superadmin user directly into PostgreSQL (Neon).
 * Run with: node prisma/seed-pg-superadmin.mjs
 */
import { createRequire } from 'module';
import { createHmac, randomBytes } from 'crypto';
import { config } from 'dotenv';

config(); // load .env

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const EMAIL = 'aimstudio@impactaistudio.com';
const PASSWORD = 'Goodness@1011';
const NAME = 'Super Admin';

async function main() {
  console.log('Connecting to:', process.env.DATABASE_URL?.slice(0, 40) + '...');

  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });

  if (existing) {
    if (existing.role !== 'superadmin') {
      await prisma.user.update({
        where: { email: EMAIL },
        data: { role: 'superadmin', emailVerified: true },
      });
      console.log(`✅ Updated existing user to superadmin: ${EMAIL}`);
    } else {
      console.log(`✅ Superadmin already exists: ${EMAIL}`);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      passwordHash,
      name: NAME,
      role: 'superadmin',
      tokenVersion: 0,
      emailVerified: true,
    },
    select: { id: true, email: true, role: true },
  });

  console.log(`✅ Created superadmin:`, user);
  console.log(`   Login at /login with: ${EMAIL} / ${PASSWORD}`);
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
