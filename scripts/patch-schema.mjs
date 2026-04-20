/**
 * Patches prisma/schema.prisma to add:
 * 1. T4 placement columns to FilmSubtitle
 * 2. SubtitleRevision model for T3-B revision history
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const schemaPath = join(__dir, '..', 'prisma', 'schema.prisma')

let schema = readFileSync(schemaPath, 'utf8')

// ── 1. Add placement + revision relation fields to FilmSubtitle ────────────
const OLD_SUBTITLE = `  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  project          Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, episodeId])
  @@index([projectId])
}`

if (schema.includes(OLD_SUBTITLE.replace(/\n/g, '\r\n'))) {
  // CRLF version
  const old = OLD_SUBTITLE.replace(/\n/g, '\r\n')
  const replacement = `  createdAt        DateTime @default(now())\r\n  updatedAt        DateTime @updatedAt\r\n\r\n  // \u252c T4: Track-level subtitle placement (defaults for all cues) \u252c\r\n  verticalAnchor   String   @default("bottom")  // bottom|lower_third|middle|upper_third|top\r\n  horizontalAlign  String   @default("center")  // left|center|right\r\n  offsetYPercent   Float    @default(0)\r\n  offsetXPercent   Float    @default(0)\r\n  safeAreaMarginPx Int      @default(12)\r\n  backgroundStyle  String   @default("shadow")  // none|shadow|box\r\n  fontScale        Float    @default(1.0)\r\n  // JSON: per-cue overrides keyed by cue index string\r\n  cueOverrides     String   @default("{}")\r\n\r\n  project          Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)\r\n  revisions        SubtitleRevision[]\r\n\r\n  @@unique([projectId, episodeId])\r\n  @@index([projectId])\r\n}`
  schema = schema.replace(old, replacement)
  console.log('✅ FilmSubtitle placement fields + revisions relation added')
} else if (schema.includes(OLD_SUBTITLE)) {
  const replacement = `  createdAt        DateTime @default(now())\n  updatedAt        DateTime @updatedAt\n\n  // ─ T4: Track-level subtitle placement ─\n  verticalAnchor   String   @default("bottom")\n  horizontalAlign  String   @default("center")\n  offsetYPercent   Float    @default(0)\n  offsetXPercent   Float    @default(0)\n  safeAreaMarginPx Int      @default(12)\n  backgroundStyle  String   @default("shadow")\n  fontScale        Float    @default(1.0)\n  cueOverrides     String   @default("{}")\n\n  project          Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)\n  revisions        SubtitleRevision[]\n\n  @@unique([projectId, episodeId])\n  @@index([projectId])\n}`
  schema = schema.replace(OLD_SUBTITLE, replacement)
  console.log('✅ FilmSubtitle placement fields + revisions relation added (LF)')
} else {
  console.error('❌ Could not find FilmSubtitle closing block — check schema manually')
  process.exit(1)
}

// ── 2. Check if SubtitleRevision already added ────────────────────────────────
if (schema.includes('model SubtitleRevision')) {
  console.log('ℹ️  SubtitleRevision model already present — skipping')
} else {
  // Insert after the FilmSubtitle closing brace
  const INSERT_AFTER = schema.includes('\r\n') 
    ? '  @@index([projectId])\r\n}\r\n'
    : '  @@index([projectId])\n}\n'

  const REVISION_MODEL_CRLF = `\r\n// \u252c T3-B: Server-side subtitle revision history \u252c\r\nmodel SubtitleRevision {\r\n  id             String       @id @default(cuid())\r\n  subtitleId     String\r\n  savedAt        DateTime     @default(now())\r\n  savedBy        String\r\n  savedByEmail   String       @default("")\r\n  changeSource   String       // manual_edit|import_srt|import_vtt|auto_generate|approve|translate|restore_revision\r\n  segmentsSnap   String\r\n  placementSnap  String       @default("{}")\r\n  subtitle       FilmSubtitle @relation(fields: [subtitleId], references: [id], onDelete: Cascade)\r\n\r\n  @@index([subtitleId, savedAt])\r\n}\r\n`

  const REVISION_MODEL_LF = `\n// ─ T3-B: Server-side subtitle revision history ─\nmodel SubtitleRevision {\n  id             String       @id @default(cuid())\n  subtitleId     String\n  savedAt        DateTime     @default(now())\n  savedBy        String\n  savedByEmail   String       @default("")\n  changeSource   String\n  segmentsSnap   String\n  placementSnap  String       @default("{}")\n  subtitle       FilmSubtitle @relation(fields: [subtitleId], references: [id], onDelete: Cascade)\n\n  @@index([subtitleId, savedAt])\n}\n`

  // Find the FilmSubtitle closing block and insert after it
  const marker = schema.includes('\r\n') 
    ? '  @@index([projectId])\r\n}\r\n\r\nmodel CastingCall'
    : '  @@index([projectId])\n}\n\nmodel CastingCall'

  if (schema.includes(marker)) {
    const castingReplacement = schema.includes('\r\n')
      ? marker.replace('\r\nmodel CastingCall', REVISION_MODEL_CRLF + '\r\nmodel CastingCall')
      : marker.replace('\nmodel CastingCall', REVISION_MODEL_LF + '\nmodel CastingCall')
    schema = schema.replace(marker, castingReplacement)
    console.log('✅ SubtitleRevision model inserted after FilmSubtitle')
  } else {
    console.error('❌ Could not find insertion point for SubtitleRevision')
    process.exit(1)
  }
}

writeFileSync(schemaPath, schema, 'utf8')
console.log('✅ schema.prisma written successfully')
