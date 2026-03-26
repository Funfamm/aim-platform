// @ts-nocheck
import { PrismaClient } from '.prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

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
            aboutText: 'AIM Studio is at the forefront of AI-driven cinema, blending cutting-edge artificial intelligence with timeless storytelling. We create compelling visual narratives that push the boundaries of what is possible in modern filmmaking.',
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
            description: 'In a world where memories can be digitized and traded, a young archivist discovers a forbidden memory that could unravel the fabric of society. As she delves deeper into the echo chambers of the past, she must confront the truth about her own existence and the price of knowledge in a post-truth era.',
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
            description: 'After an ecological collapse renders the Earth barren, an elderly botanist tends to the last surviving garden in a biodome. When a mysterious stranger arrives claiming to know the secret to restoring the planet, she must decide whether to trust him or protect the garden that has become her entire world.',
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
            description: 'In a rain-soaked cyberpunk metropolis, a disillusioned detective is hired to find a missing AI preacher who has been converting the masses to a new digital religion. As he navigates the neon-drenched underworld, he discovers that the line between faith and code is thinner than he imagined.',
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
            description: 'A rescue mission deep in an uncharted rainforest uncovers an ancient network of bio-luminescent organisms that communicate through a protocol eerily similar to artificial neural networks. When the team realizes the jungle is watching them back, survival becomes a negotiation with nature itself.',
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
            description: 'A haunting psychological thriller about a glass sculptor who starts seeing disturbing visions in her creations. Each piece she crafts reveals a fragment of a crime that has not yet been committed, pulling her into a race against time to prevent a tragedy that mirrors her own buried past.',
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

    // Create casting calls for upcoming projects
    const jungleProject = await prisma.project.findUnique({
        where: { slug: 'jungle-protocol' },
    })

    const glassProject = await prisma.project.findUnique({
        where: { slug: 'glass-requiem' },
    })

    const neonProject = await prisma.project.findUnique({
        where: { slug: 'neon-saints' },
    })

    if (jungleProject) {
        await prisma.castingCall.createMany({
            data: [
                {
                    projectId: jungleProject.id,
                    roleName: 'Dr. Maya Reyes',
                    roleType: 'lead',
                    roleDescription: 'A brilliant but haunted xenobiologist leading the rescue team. She carries the weight of a previous expedition that went wrong.',
                    ageRange: '30-40',
                    gender: 'Female',
                    requirements: 'Strong dramatic range, comfortable with action sequences. Experience with emotional vulnerability. Athletic build preferred.',
                    compensation: 'SAG-AFTRA rates',
                    deadline: '2026-04-15',
                    status: 'open',
                },
                {
                    projectId: jungleProject.id,
                    roleName: 'Kai Torres',
                    roleType: 'supporting',
                    roleDescription: 'The team\'s tech specialist who becomes the first to communicate with the jungle network. Curious, witty, and brave.',
                    ageRange: '25-35',
                    gender: 'Any',
                    requirements: 'Natural charisma, ability to convey wonder and fear. Tech-savvy demeanor. Diverse backgrounds encouraged.',
                    compensation: 'SAG-AFTRA rates',
                    deadline: '2026-04-15',
                    status: 'open',
                },
            ],
        })
    }

    if (glassProject) {
        await prisma.castingCall.createMany({
            data: [
                {
                    projectId: glassProject.id,
                    roleName: 'Elara Voss',
                    roleType: 'lead',
                    roleDescription: 'A reclusive glass sculptor whose art begins to reveal future crimes. Haunted by her past, she must confront her own demons to prevent tragedy.',
                    ageRange: '28-38',
                    gender: 'Female',
                    requirements: 'Exceptional dramatic ability, comfort with psychological intensity. Ethereal quality. Experience with artistic/creative character portrayals preferred.',
                    compensation: 'Negotiable',
                    deadline: '2026-05-01',
                    status: 'open',
                },
            ],
        })
    }

    if (neonProject) {
        await prisma.castingCall.createMany({
            data: [
                {
                    projectId: neonProject.id,
                    roleName: 'Detective Harlan Cross',
                    roleType: 'lead',
                    roleDescription: 'A world-weary detective navigating a neon-soaked underworld. Sardonic exterior masks a crisis of faith.',
                    ageRange: '35-50',
                    gender: 'Male',
                    requirements: 'Strong screen presence, noir sensibility. Gravelly voice a plus. Comfortable with morally complex characters.',
                    compensation: 'SAG-AFTRA rates',
                    deadline: '2026-04-01',
                    status: 'open',
                },
                {
                    projectId: neonProject.id,
                    roleName: 'Prophet-7',
                    roleType: 'supporting',
                    roleDescription: 'The missing AI preacher — part hologram, part human vessel. Charismatic and unsettling in equal measure.',
                    ageRange: '20-45',
                    gender: 'Any',
                    requirements: 'Commanding presence, ability to convey both serenity and menace. Experience with philosophical/spiritual roles. Unique look preferred.',
                    compensation: 'SAG-AFTRA rates',
                    deadline: '2026-04-01',
                    status: 'open',
                },
            ],
        })
    }

    console.log('✅ Casting calls created')
    console.log('🎬 Seed complete!')
}

seed()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
