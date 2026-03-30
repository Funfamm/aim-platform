import { prisma } from '@/lib/db';

async function main() {
  // 1. Create a sample project (required fields)
  const project = await prisma.project.create({
    data: {
      title: 'Demo Film',
      slug: 'demo-film',
      description: 'A demo project for search testing',
      // optional but nice to have
      tagline: 'Demo tagline',
      genre: 'Drama',
      year: '2024',
      translations: JSON.stringify({
        es: { title: 'Película Demo', tagline: 'Un proyecto de demostración' },
        fr: { title: 'Film Démo', tagline: 'Un projet de démonstration' },
      }),
    },
  });

  // 2. Create a sample casting call linked to the project
  await prisma.castingCall.create({
    data: {
      roleName: 'Lead Actor',
      roleDescription: 'Looking for a charismatic lead actor',
      roleType: 'On Camera',
      status: 'open',
      requirements: 'Must be able to perform stunts',
      // Connect to the project we just created
      project: { connect: { id: project.id } },
      translations: JSON.stringify({
        es: { roleName: 'Actor Principal', roleDescription: 'Buscando un actor carismático' },
      }),
    },
  });

  // 3. Create a sample script call
  await prisma.scriptCall.create({
    data: {
      title: 'Demo Script',
      description: 'A short script for testing search',
      isPublic: true,
      genre: 'Comedy',
    },
  });

  // 4. Create a sample course
  await prisma.course.create({
    data: {
      title: 'Intro to Filmmaking',
      slug: 'intro-to-filmmaking',
      description: 'Learn the basics of filmmaking',
      category: 'education',
      published: true,
      translations: JSON.stringify({
        es: { title: 'Introducción a la realización de películas', description: 'Aprende los conceptos básicos' },
      }),
    },
  });

  console.log('✅ Sample data created');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Error creating sample data', e);
  process.exit(1);
});
