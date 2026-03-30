import { prisma } from '@/lib/db';

async function main() {
  try {
    const project = await prisma.project.create({
      data: {
        title: 'Debug Project',
        slug: 'debug-project',
        description: 'Debug project',
        tagline: 'Debug',
        genre: 'Drama',
        year: '2024',
      },
    });
    console.log('Project created', project.id);
    const casting = await prisma.castingCall.create({
      data: {
        roleName: 'Lead Actor',
        roleDescription: 'Charismatic lead',
        roleType: 'On Camera',
        status: 'open',
        requirements: 'Must be able to perform stunts',
        project: { connect: { id: project.id } },
      },
    });
    console.log('Casting created', casting.id);
  } catch (e) {
    console.error('Error creating data', e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
