const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function testRegister() {
  const name = 'Test User';
  const email = `test${Date.now()}@example.com`;
  const password = 'password123';
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = await prisma.user.create({
      data: { name, email, passwordHash, role: 'member' },
    });
    console.log('User created id', newUser.id);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await prisma.user.update({
      where: { id: newUser.id },
      data: {
          emailVerified: false,
          verificationCode: code,
          verificationExpiry: new Date(expiry),
      }
    });
    console.log('Verification fields set');
  } catch (e) {
    console.error('Error during registration test:', e);
  } finally {
    await prisma.$disconnect();
  }
}

testRegister();
