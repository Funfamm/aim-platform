const { PrismaClient } = require('@prisma/client')
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
const path = require('path')

const adapter = new PrismaBetterSqlite3({
    url: path.join(process.cwd(), 'prisma', 'dev.db'),
})
const prisma = new PrismaClient({ adapter })

async function main() {
    // Check if already seeded
    const count = await prisma.heroVideo.count()
    if (count > 0) {
        console.log(`Already have ${count} hero videos, skipping seed.`)
        return
    }

    await prisma.heroVideo.createMany({
        data: [
            { title: 'Boxing Scene', url: '/videos/1.mp4', duration: 10, page: 'all', active: true, sortOrder: 1 },
            { title: 'Ring Action', url: '/videos/2.mp4', duration: 10, page: 'all', active: true, sortOrder: 2 },
            { title: 'Fight Clip', url: '/videos/3.mp4', duration: 10, page: 'all', active: true, sortOrder: 3 },
        ],
    })

    const total = await prisma.heroVideo.count()
    console.log(`Seeded ${total} hero videos successfully!`)
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
