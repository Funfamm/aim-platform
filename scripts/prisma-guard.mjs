#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  PRISMA PRODUCTION GUARD                                           ║
 * ║  Prevents destructive Prisma commands from running against         ║
 * ║  the production database.                                          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * This script is called BEFORE any Prisma CLI command via package.json
 * scripts. It inspects DATABASE_URL and blocks destructive operations
 * (migrate dev, db push, migrate reset, db seed) if the URL matches
 * a known production host pattern.
 *
 * Safe operations (migrate deploy, generate, studio) are always allowed.
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

// Load .env (same way Prisma does)
config({ path: resolve(projectRoot, '.env') })

// ── Configuration ────────────────────────────────────────────────────────
// Add your production database hostnames here. Any DATABASE_URL that
// contains one of these strings will be considered "production".
const PRODUCTION_HOST_PATTERNS = [
  '.neon.tech',           // Neon PostgreSQL
  '.supabase.co',         // Supabase
  '.render.com',          // Render managed PG
  '.railway.app',         // Railway
  '.planetscale.com',     // PlanetScale
  '.amazonaws.com',       // AWS RDS
  '.azure.com',           // Azure Database
  '.googlecloud.com',     // GCP Cloud SQL
  '.elephantsql.com',     // ElephantSQL
]

// Commands that can destroy or alter production data
const DESTRUCTIVE_COMMANDS = [
  'migrate dev',
  'migrate reset',
  'db push',
  'db push --force-reset',
  'db seed',
]

// Commands that are always safe (non-destructive)
const SAFE_COMMANDS = [
  'migrate deploy',   // Applies pending migrations without creating new ones
  'generate',         // Generates Prisma Client only
  'studio',           // Opens Prisma Studio (read-only browser)
  'migrate status',   // Just checks status
  'db pull',          // Reads schema, does not write
]

// ── Main ─────────────────────────────────────────────────────────────────
const databaseUrl = process.env.DATABASE_URL || ''
const args = process.argv.slice(2)
const command = args.join(' ')

// Determine if the current DATABASE_URL is production
const isProduction = PRODUCTION_HOST_PATTERNS.some(pattern =>
  databaseUrl.toLowerCase().includes(pattern.toLowerCase())
)

// Determine if the command is destructive
const isDestructive = DESTRUCTIVE_COMMANDS.some(cmd =>
  command.includes(cmd)
)

// Determine if the command is explicitly safe
const isSafe = SAFE_COMMANDS.some(cmd =>
  command.includes(cmd)
)

if (isProduction && isDestructive && !isSafe) {
  const maskedUrl = databaseUrl.replace(
    /\/\/([^:]+):([^@]+)@/,
    '//$1:****@'
  )

  console.error('')
  console.error('╔══════════════════════════════════════════════════════════════════╗')
  console.error('║  🛑  PRODUCTION DATABASE GUARD — COMMAND BLOCKED               ║')
  console.error('╠══════════════════════════════════════════════════════════════════╣')
  console.error('║                                                                ║')
  console.error('║  You are about to run a DESTRUCTIVE Prisma command against     ║')
  console.error('║  what appears to be a PRODUCTION database.                     ║')
  console.error('║                                                                ║')
  console.error(`║  Command:  prisma ${command.padEnd(46)}║`)
  console.error(`║  DB Host:  ${maskedUrl.slice(0, 54).padEnd(54)}║`)
  console.error('║                                                                ║')
  console.error('║  This command can DROP TABLES and DESTROY DATA.                ║')
  console.error('║                                                                ║')
  console.error('║  To fix this:                                                  ║')
  console.error('║  1. Update .env to use your DEV database URL                   ║')
  console.error('║  2. Or create a Neon dev branch for safe development           ║')
  console.error('║  3. Keep production URLs only in Render env vars               ║')
  console.error('║                                                                ║')
  console.error('║  For production migrations, use:  npm run db:deploy            ║')
  console.error('║  (This runs prisma migrate deploy — safe & non-destructive)    ║')
  console.error('║                                                                ║')
  console.error('╚══════════════════════════════════════════════════════════════════╝')
  console.error('')

  process.exit(1)
}

// If we reach here, the command is allowed
if (isProduction && isSafe) {
  console.log('✅ Production database detected — safe command allowed:', command)
}

if (!isProduction) {
  console.log('✅ Development database detected — command allowed:', command)
}

// Exit 0 to let the npm script chain continue
process.exit(0)
