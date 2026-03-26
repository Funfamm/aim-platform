const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

(async () => {
  const prisma = new PrismaClient();
  try {
    const email = 'aimstudio@impactaistudio.com';
    const password = 'Goodness@1011';
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: {
        email,
        passwordHash,
        name: 'Super Admin',
        role: 'superadmin',
        tokenVersion: 0,
        emailVerified: true,
      },
      select: { id: true, email: true, role: true },
    });
    console.log('Superadmin upserted:', user);
  } catch (e) {
    console.error('Seed error:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
