const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'prisma', 'dev.db')
const EMAIL = 'aimstudio@impactaistudio.com'
const PASSWORD = 'Goodness@1011??'

async function main() {
  const db = new Database(DB_PATH)

  // Check existing user
  const existing = db.prepare('SELECT id, email, role, emailVerified FROM "User" WHERE email = ?').get(EMAIL)
  console.log('Existing user:', JSON.stringify(existing, null, 2))

  const hashedPassword = await bcrypt.hash(PASSWORD, 12)

  if (existing) {
    // Update: ensure role=superadmin, emailVerified=1, and correct password hash
    db.prepare('UPDATE "User" SET role = ?, emailVerified = 1, passwordHash = ? WHERE email = ?')
      .run('superadmin', hashedPassword, EMAIL)
    const updated = db.prepare('SELECT id, email, role, emailVerified FROM "User" WHERE email = ?').get(EMAIL)
    console.log('✅ Updated user:', JSON.stringify(updated, null, 2))
  } else {
    // Create the user
    const { cuid } = require('@paralleldrive/cuid2')
    const now = new Date().toISOString()
    db.prepare(`INSERT INTO "User" (id, name, email, passwordHash, role, emailVerified, tokenVersion, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?)`)
      .run(cuid(), 'Super Admin', EMAIL, hashedPassword, 'superadmin', now, now)
    const created = db.prepare('SELECT id, email, role, emailVerified FROM "User" WHERE email = ?').get(EMAIL)
    console.log('✅ Created user:', JSON.stringify(created, null, 2))
  }

  db.close()
}

main().catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
