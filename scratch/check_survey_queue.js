const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const count = await prisma.emailQueue.count({ where: { type: 'survey_campaign', status: 'pending' } });
  console.log('Pending survey_campaign emails:', count);
  await prisma.$disconnect();
})();
