const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const event = await prisma.liveEvent.findUnique({
    where: { roomName: 'welcome-on-board-0aqn' }
  });
  console.log('Event found:', event);
}

main().finally(() => prisma.$disconnect());
