import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Usage: npx tsx prisma/create-superadmin.ts <email> <password>');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // Upsert user – create if not exists, otherwise update role & password
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: 'superadmin' },
    create: {
      email,
      passwordHash,
      role: 'superadmin',
      name: 'Super Admin',
    },
  });

  console.log(`✅ Superadmin user ${user.email} is ready (id: ${user.id})`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
