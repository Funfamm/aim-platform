const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma').default;

(async () => {

  // Using shared prisma instance
  const email = 'aimstudio@impactaistudio.com';
  const password = 'Goodness@1011';
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log('Superadmin user already exists:', existing.email);
    } else {
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name: 'Super Admin',
          role: 'superadmin',
          tokenVersion: 0,
          emailVerified: true,
        },
        select: { id: true, email: true, role: true },
      });
      console.log('Created superadmin user:', user);
    }
  } catch (e) {
    console.error('Error creating superadmin:', e);
  } finally {
    await prisma.$disconnect();
  }
})();
