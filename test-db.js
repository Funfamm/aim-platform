require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const apps = await prisma.application.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, selfTapePath: true, headshotPath: true },
    take: 5
  });
  console.log(apps);
}
run();
