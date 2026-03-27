const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function testRegister() {
  const name = 'Test User';
  const email = 'testuser2@example.com';
  const password = 'password123';
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = await prisma.user.create({
      data: { name, email, passwordHash, role: 'member' },
    });
    console.log('User created id', newUser.id);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await prisma.$executeRaw`UPDATE "User" SET "emailVerified" = false, "verificationCode" = ${code}, "verificationExpiry" = ${expiry} WHERE "id" = ${newUser.id}`;
    console.log('Verification fields set');
  } catch (e) {
    console.error('Error during registration test:', e);
  } finally {
    await prisma.$disconnect();
  }
}

testRegister();
