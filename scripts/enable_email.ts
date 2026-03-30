// scripts/enable_email.ts
import { prisma } from '@/lib/db';

async function main() {
  await prisma.siteSettings.update({
    where: { id: 1 }, // assuming single row with id 1
    data: {
      emailsEnabled: true,
      smtpHost: 'smtp.office365.com',
      smtpPort: 587,
      smtpUser: 'b4386461-1d0c-4d41-973b-5daf2a8862c0',
      smtpPass: 'x.88Q~HGszuZDu9pxYDyPNSDsr9m3kQWL6TRabc6',
    },
  });
  console.log('✅ Email settings enabled');
}

main()
  .catch(e => {
    console.error('❌ Error updating settings', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
