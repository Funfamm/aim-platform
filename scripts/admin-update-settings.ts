import { prisma } from '@/lib/db';

async function main() {
  const updated = await prisma.siteSettings.update({
    where: { id: 'default' },
    data: { siteName: 'Demo Site Updated via Script' },
  });
  console.log('✅ Settings updated:', updated.siteName);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Error updating settings', e);
  process.exit(1);
});
