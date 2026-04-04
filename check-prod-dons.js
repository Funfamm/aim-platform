const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: { url: 'postgresql://neondb_owner:npg_2jrMNVBU3IkY@ep-dry-resonance-amkkbusx-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require' }
    }
});
prisma.donation.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }).then(console.log).finally(() => prisma.$disconnect());
