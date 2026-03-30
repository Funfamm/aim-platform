import { prisma } from '@/lib/db';

async function fixSiteName() {
  await prisma.siteSettings.update({
    where: { id: 'default' },
    data: {
      siteName: 'AIM Studio',
      tagline: 'AI-Powered Filmmaking',
    },
  });
  console.log('✅ Site name fixed to "AIM Studio"');
  await prisma.$disconnect();
}

fixSiteName();
