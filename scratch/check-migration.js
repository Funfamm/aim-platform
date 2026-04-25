const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe("SELECT migration_name, finished_at FROM _prisma_migrations WHERE migration_name LIKE '%sync%' ORDER BY finished_at DESC")
  .then(r => console.log(JSON.stringify(r, null, 2)))
  .finally(() => p.$disconnect());
