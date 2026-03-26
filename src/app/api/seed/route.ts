import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST() {
    try {
        // Create admin user
        const hashedPassword = await bcrypt.hash('admin123', 12)
        await prisma.admin.upsert({
            where: { username: 'admin' },
            update: {},
            create: { username: 'admin', password: hashedPassword },
        })

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
                socialLinks: JSON.stringify({ youtube: 'https://youtube.com', instagram: 'https://instagram.com', tiktok: 'https://tiktok.com', x: 'https://x.com' }),
            },
        })

        // Create sample projects
        const projects = [
            { title: 'Echoes of Tomorrow', slug: 'echoes-of-tomorrow', tagline: 'The future remembers what we choose to forget.', description: 'In a world where memories can be digitized and traded, a young archivist discovers a forbidden memory that could unravel the fabric of society. As she delves deeper into the echo chambers of the past, she must confront the truth about her own existence and the price of knowledge in a post-truth era.', status: 'completed', genre: 'Sci-Fi Thriller', year: '2025', duration: '12 min', featured: true, sortOrder: 1, coverImage: '/images/hero-bg.png' },
            { title: 'The Last Garden', slug: 'the-last-garden', tagline: 'In the ashes of civilization, life finds a way.', description: 'After an ecological collapse renders the Earth barren, an elderly botanist tends to the last surviving garden in a biodome. When a mysterious stranger arrives claiming to know the secret to restoring the planet, she must decide whether to trust him or protect the garden that has become her entire world.', status: 'completed', genre: 'Drama', year: '2025', duration: '8 min', featured: true, sortOrder: 2, coverImage: '/images/hero-bg.png' },
            { title: 'Neon Saints', slug: 'neon-saints', tagline: 'Every city has its gods. This one has algorithms.', description: 'In a rain-soaked cyberpunk metropolis, a disillusioned detective is hired to find a missing AI preacher who has been converting the masses to a new digital religion.', status: 'in-production', genre: 'Cyberpunk Noir', year: '2026', duration: 'TBD', featured: true, sortOrder: 3, coverImage: '/images/hero-bg.png' },
            { title: 'Jungle Protocol', slug: 'jungle-protocol', tagline: 'Nature has its own intelligence.', description: 'A rescue mission deep in an uncharted rainforest uncovers an ancient network of bio-luminescent organisms that communicate through a protocol eerily similar to artificial neural networks.', status: 'upcoming', genre: 'Adventure Sci-Fi', year: '2026', duration: 'TBD', featured: false, sortOrder: 4, coverImage: '/images/hero-bg.png' },
            { title: 'Glass Requiem', slug: 'glass-requiem', tagline: 'Some reflections show more than what is there.', description: 'A haunting psychological thriller about a glass sculptor who starts seeing disturbing visions in her creations.', status: 'upcoming', genre: 'Psychological Thriller', year: '2026', duration: 'TBD', featured: false, sortOrder: 5, coverImage: '/images/hero-bg.png' },
        ]

        for (const project of projects) {
            await prisma.project.upsert({ where: { slug: project.slug }, update: project, create: project })
        }

        // Create casting calls
        const jungle = await prisma.project.findUnique({ where: { slug: 'jungle-protocol' } })
        const glass = await prisma.project.findUnique({ where: { slug: 'glass-requiem' } })
        const neon = await prisma.project.findUnique({ where: { slug: 'neon-saints' } })

        await prisma.castingCall.deleteMany({})

        if (jungle) {
            await prisma.castingCall.createMany({
                data: [
                    { projectId: jungle.id, roleName: 'Dr. Maya Reyes', roleType: 'lead', roleDescription: 'A brilliant but haunted xenobiologist leading the rescue team. She carries the weight of a previous expedition that went wrong.', ageRange: '30-40', gender: 'Female', requirements: 'Strong dramatic range, comfortable with action sequences. Experience with emotional vulnerability.', compensation: 'Voluntary', deadline: '2026-04-15', status: 'open' },
                    { projectId: jungle.id, roleName: 'Kai Torres', roleType: 'supporting', roleDescription: 'The team\'s tech specialist who becomes the first to communicate with the jungle network. Curious, witty, and brave.', ageRange: '25-35', gender: 'Any', requirements: 'Natural charisma, ability to convey wonder and fear. Diverse backgrounds encouraged.', compensation: 'Voluntary', deadline: '2026-04-15', status: 'open' },
                ],
            })
        }

        if (glass) {
            await prisma.castingCall.create({
                data: { projectId: glass.id, roleName: 'Elara Voss', roleType: 'lead', roleDescription: 'A reclusive glass sculptor whose art begins to reveal future crimes. Haunted by her past.', ageRange: '28-38', gender: 'Female', requirements: 'Exceptional dramatic ability, comfort with psychological intensity. Ethereal quality.', compensation: 'Voluntary', deadline: '2026-05-01', status: 'open' },
            })
        }

        if (neon) {
            await prisma.castingCall.createMany({
                data: [
                    { projectId: neon.id, roleName: 'Detective Harlan Cross', roleType: 'lead', roleDescription: 'A world-weary detective navigating a neon-soaked underworld. Sardonic exterior masks a crisis of faith.', ageRange: '35-50', gender: 'Male', requirements: 'Strong screen presence, noir sensibility. Gravelly voice a plus.', compensation: 'Voluntary', deadline: '2026-04-01', status: 'open' },
                    { projectId: neon.id, roleName: 'Prophet-7', roleType: 'supporting', roleDescription: 'The missing AI preacher — part hologram, part human vessel. Charismatic and unsettling in equal measure.', ageRange: '20-45', gender: 'Any', requirements: 'Commanding presence, ability to convey both serenity and menace. Unique look preferred.', compensation: 'Voluntary', deadline: '2026-04-01', status: 'open' },
                ],
            })
        }

        return NextResponse.json({ success: true, message: 'Database seeded successfully' })
    } catch (error) {
        console.error('Seed error:', error)
        return NextResponse.json({ error: 'Seed failed' }, { status: 500 })
    }
}
