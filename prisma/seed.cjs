const { PrismaClient } = require('.prisma/client')
const bcrypt = require('bcryptjs')
const path = require('path')

const prisma = new PrismaClient({
    datasourceUrl: 'file:' + path.join(__dirname, 'dev.db'),
})

async function seed() {
    console.log('🎬 Seeding AIM Studio database...')

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 12)
    await prisma.admin.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            password: hashedPassword,
        },
    })
    console.log('✅ Admin user created (admin / admin123)')

    // Create site settings
    await prisma.siteSettings.upsert({
        where: { id: 'default' },
        update: {},
        create: {
            id: 'default',
            siteName: 'AIM Studio',
            tagline: 'AI-Powered Filmmaking',
            aboutText: 'AIM Studio is at the forefront of AI-driven cinema.',
            contactEmail: 'contact@aimstudio.ai',
            socialLinks: JSON.stringify({
                youtube: 'https://youtube.com',
                instagram: 'https://instagram.com',
                tiktok: 'https://tiktok.com',
                x: 'https://x.com',
            }),
        },
    })
    console.log('✅ Site settings created')

    // Create sample projects
    const projects = [
        {
            title: 'Echoes of Tomorrow',
            slug: 'echoes-of-tomorrow',
            tagline: 'The future remembers what we choose to forget.',
            description: 'In a world where memories can be digitized and traded, a young archivist discovers a forbidden memory that could unravel the fabric of society.',
            status: 'completed',
            genre: 'Sci-Fi Thriller',
            year: '2025',
            duration: '12 min',
            featured: true,
            sortOrder: 1,
            coverImage: '/images/hero-bg.png',
        },
        {
            title: 'The Last Garden',
            slug: 'the-last-garden',
            tagline: 'In the ashes of civilization, life finds a way.',
            description: 'After an ecological collapse renders the Earth barren, an elderly botanist tends to the last surviving garden in a biodome.',
            status: 'completed',
            genre: 'Drama',
            year: '2025',
            duration: '8 min',
            featured: true,
            sortOrder: 2,
            coverImage: '/images/hero-bg.png',
        },
        {
            title: 'Neon Saints',
            slug: 'neon-saints',
            tagline: 'Every city has its gods. This one has algorithms.',
            description: 'In a rain-soaked cyberpunk metropolis, a disillusioned detective is hired to find a missing AI preacher who has been converting the masses to a new digital religion.',
            status: 'in-production',
            genre: 'Cyberpunk Noir',
            year: '2026',
            duration: 'TBD',
            featured: true,
            sortOrder: 3,
            coverImage: '/images/hero-bg.png',
        },
        {
            title: 'Jungle Protocol',
            slug: 'jungle-protocol',
            tagline: 'Nature has its own intelligence.',
            description: 'A rescue mission deep in an uncharted rainforest uncovers an ancient network of bio-luminescent organisms that communicate through a protocol eerily similar to artificial neural networks.',
            status: 'upcoming',
            genre: 'Adventure Sci-Fi',
            year: '2026',
            duration: 'TBD',
            featured: false,
            sortOrder: 4,
            coverImage: '/images/hero-bg.png',
        },
        {
            title: 'Glass Requiem',
            slug: 'glass-requiem',
            tagline: 'Some reflections show more than what is there.',
            description: 'A haunting psychological thriller about a glass sculptor who starts seeing disturbing visions in her creations.',
            status: 'upcoming',
            genre: 'Psychological Thriller',
            year: '2026',
            duration: 'TBD',
            featured: false,
            sortOrder: 5,
            coverImage: '/images/hero-bg.png',
        },
    ]

    for (const project of projects) {
        await prisma.project.upsert({
            where: { slug: project.slug },
            update: project,
            create: project,
        })
    }
    console.log(`✅ ${projects.length} projects created`)

    // Create casting calls
    const junProject = await prisma.project.findUnique({ where: { slug: 'jungle-protocol' } })
    const glaProject = await prisma.project.findUnique({ where: { slug: 'glass-requiem' } })
    const neoProject = await prisma.project.findUnique({ where: { slug: 'neon-saints' } })

    await prisma.castingCall.deleteMany({})

    if (junProject) {
        await prisma.castingCall.createMany({
            data: [
                { projectId: junProject.id, roleName: 'Dr. Maya Reyes', roleType: 'lead', roleDescription: 'A brilliant but haunted xenobiologist leading the rescue team.', ageRange: '30-40', gender: 'Female', requirements: 'Strong dramatic range, comfortable with action sequences.', compensation: 'Voluntary', deadline: '2026-04-15', status: 'open' },
                { projectId: junProject.id, roleName: 'Kai Torres', roleType: 'supporting', roleDescription: 'The team\'s tech specialist who becomes the first to communicate with the jungle network.', ageRange: '25-35', gender: 'Any', requirements: 'Natural charisma, ability to convey wonder and fear.', compensation: 'Voluntary', deadline: '2026-04-15', status: 'open' },
            ],
        })
    }

    if (glaProject) {
        await prisma.castingCall.create({
            data: { projectId: glaProject.id, roleName: 'Elara Voss', roleType: 'lead', roleDescription: 'A reclusive glass sculptor whose art begins to reveal future crimes.', ageRange: '28-38', gender: 'Female', requirements: 'Exceptional dramatic ability, comfort with psychological intensity.', compensation: 'Voluntary', deadline: '2026-05-01', status: 'open' },
        })
    }

    if (neoProject) {
        await prisma.castingCall.createMany({
            data: [
                { projectId: neoProject.id, roleName: 'Detective Harlan Cross', roleType: 'lead', roleDescription: 'A world-weary detective navigating a neon-soaked underworld.', ageRange: '35-50', gender: 'Male', requirements: 'Strong screen presence, noir sensibility.', compensation: 'Voluntary', deadline: '2026-04-01', status: 'open' },
                { projectId: neoProject.id, roleName: 'Prophet-7', roleType: 'supporting', roleDescription: 'The missing AI preacher, part hologram, part human vessel. Charismatic and unsettling in equal measure.', ageRange: '20-45', gender: 'Any', requirements: 'Commanding presence, ability to convey both serenity and menace.', compensation: 'Voluntary', deadline: '2026-04-01', status: 'open' },
            ],
        })
    }

    console.log('✅ Casting calls created')
    console.log('🎬 Seed complete!')
}

seed()
    .catch((e) => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())
