const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.siteSettings.findFirst();
  if (!settings) { console.error('No settings row!'); return; }

  const updated = await prisma.siteSettings.update({
    where: { id: settings.id },
    data: {
      emailsEnabled: true,
      smtpHost: 'graph',
      smtpPort: 587,
      smtpUser: 'aimstudio@impactaistudio.com',
      smtpPass: 'graph-api',
      smtpFromName: 'AIM Studio',
      smtpFromEmail: 'aimstudio@impactaistudio.com',
      smtpSecure: false,
    }
  });
  console.log('emailsEnabled:', updated.emailsEnabled);
  console.log('smtpFromEmail:', updated.smtpFromEmail);
}

main().catch(console.error).finally(() => prisma.$disconnect());
