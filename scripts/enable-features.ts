import { prisma } from '@/lib/db';

async function enableFeatures() {
  try {
    await prisma.siteSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        scriptCallsEnabled: true,
        trainingEnabled: true,
        castingCallsEnabled: true,
        requireLoginForCasting: false,
      },
      update: {
        scriptCallsEnabled: true,
        trainingEnabled: true,
        castingCallsEnabled: true,
        requireLoginForCasting: false,
      },
    });
    console.log('Feature flags enabled successfully');
  } catch (err) {
    console.error('Failed to enable features', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

enableFeatures();
