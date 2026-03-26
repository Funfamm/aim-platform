const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findUnique({ where: { email: 'aimstudio@impactaistudio.com' }, select: { emailVerified: true, role: true } })
  .then(u => { console.log('Superadmin:', JSON.stringify(u)); })
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
