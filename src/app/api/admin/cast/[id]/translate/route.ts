import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserSession } from '@/lib/auth'
import { callGemini } from '@/lib/gemini'
import { LANGUAGE_NAMES } from '@/lib/subtitle-languages'

async function requireAdmin() {
    const session = await getUserSession()
    if (!session?.userId) return { error: 'Unauthorized', status: 401 }
    if (session.role !== 'admin' && session.role !== 'superadmin') return { error: 'Forbidden', status: 403 }
    return null
}

// All target languages (English is the source)
const TARGET_LANGS = ['ar', 'de', 'es', 'fr', 'hi', 'ja', 'ko', 'pt', 'ru', 'zh']

// POST /api/admin/cast/[id]/translate
// Translates bio and character name for a cast member into all 10 non-English languages.
// Saves result as bioTranslations JSON on the FilmCast record.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status })

    const { id } = await params

    // Fetch the member
    let member
    try {
        member = await prisma.filmCast.findUnique({ where: { id } })
    } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!member) return NextResponse.json({ error: 'Cast member not found' }, { status: 404 })

    const { bio, character } = member
    if (!bio && !character) {
        return NextResponse.json({ error: 'No bio or character to translate' }, { status: 400 })
    }

    // Build the combined translation prompt
    // We bundle bio + character into a single Gemini call per language to save API calls.
    const bioTranslations: Record<string, { bio: string; character: string }> = {}
    const errors: string[] = []

    for (const lang of TARGET_LANGS) {
        const langName = LANGUAGE_NAMES[lang] || lang
        const fields: Record<string, string> = {}
        if (bio) fields.bio = bio
        if (character) fields.character = character

        const prompt = [
            `You are a professional translator for a film platform.`,
            `Translate the following JSON object from English to ${langName} (language code: ${lang}).`,
            `Rules:`,
            `- Return ONLY a valid JSON object with the same keys`,
            `- Preserve proper nouns (character names, place names)`,
            `- Match cinematic, professional tone`,
            `- "character" is a character name in a film — transliterate if needed, do not over-translate`,
            `- Do NOT add any text outside the JSON`,
            ``,
            `Input:`,
            JSON.stringify(fields),
        ].join('\n')

        try {
            const result = await callGemini(prompt, 'cast-translate')
            if ('error' in result) throw new Error(result.error)

            const jsonMatch = result.text.match(/\{[\s\S]*\}/)
            if (!jsonMatch) throw new Error('No JSON in Gemini response')

            const parsed = JSON.parse(jsonMatch[0])
            bioTranslations[lang] = {
                bio: parsed.bio || bio || '',
                character: parsed.character || character || '',
            }
        } catch (e) {
            errors.push(`${lang}: ${(e as Error).message}`)
            // Fall back to English source
            bioTranslations[lang] = { bio: bio || '', character: character || '' }
        }
    }

    // Persist to DB
    const updatedMember = await prisma.filmCast.update({
        where: { id },
        data: { bioTranslations: JSON.stringify(bioTranslations) },
    })

    return NextResponse.json({
        member: updatedMember,
        translatedCount: TARGET_LANGS.length - errors.length,
        errors: errors.length > 0 ? errors : undefined,
    })
}
