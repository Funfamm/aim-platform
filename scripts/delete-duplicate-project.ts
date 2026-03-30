import { prisma } from '@/lib/db';

async function main() {
  // Delete any existing project with the slug used in sample data
  const deleted = await prisma.project.deleteMany({
    where: { slug: { in: ['debug-project', 'demo-film'] } },
  });
  console.log(`Deleted ${deleted.count} duplicate project(s)`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error deleting projects', e);
  process.exit(1);
});
