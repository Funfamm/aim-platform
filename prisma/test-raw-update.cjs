const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // create a test user
    const user = await prisma.user.create({
      data: {
        name: 'RawTest',
        email: 'rawtest@example.com',
        passwordHash: 'dummyhash',
        role: 'member',
      },
    });
    console.log('Created user id', user.id);
    const code = '123456';
    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await prisma.$executeRaw`UPDATE "User" SET "emailVerified" = false, "verificationCode" = ${code}, "verificationExpiry" = ${expiry} WHERE "id" = ${user.id}`;
    console.log('Raw update succeeded');
  } catch (e) {
    console.error('Error during raw update', e);
  } finally {
    await prisma.$disconnect();
  }
})();
