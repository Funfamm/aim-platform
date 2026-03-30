import { prisma } from '@/lib/db';

async function check() {
  const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
  const projectCount = await prisma.project.count();
  const castingCount = await prisma.castingCall.count();
  const scriptCount = await prisma.scriptCall.count();
  const courseCount = await prisma.course.count();
  console.log('SiteSettings:', JSON.stringify(settings, null, 2));
  console.log('Projects:', projectCount);
  console.log('CastingCalls:', castingCount);
  console.log('ScriptCalls:', scriptCount);
  console.log('Courses:', courseCount);
  await prisma.$disconnect();
}

check();
