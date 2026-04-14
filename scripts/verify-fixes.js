const fs = require('fs')

const rs    = fs.readFileSync('src/components/live/RoomShell.tsx', 'utf8')
const del   = fs.readFileSync('src/app/api/livekit/rooms/[id]/route.ts', 'utf8')
const sch   = fs.readFileSync('prisma/schema.prisma', 'utf8')
const admin = fs.readFileSync('src/app/admin/events/page.tsx', 'utf8')
const works = fs.readFileSync('src/components/WorksPageClient.tsx', 'utf8')
const page  = fs.existsSync('src/app/[locale]/events/[roomName]/page.tsx')

const checks = [
  ['Fix 1 - leftRoomRef used in RoomShell',    rs.includes('leftRoomRef.current')],
  ['Fix 1 - leftRoom state removed',           !rs.includes('setLeftRoom')],
  ['Fix 1 - leftRoom NOT in fetchToken deps',  !rs.includes('[roomName, role, leftRoom]')],
  ['Fix 2 - deleteMany atomic guard',          del.includes('deleteMany')],
  ['Fix 2 - status not:live clause',           del.includes("not: 'live'")],
  ['Fix 3 - onDelete SetNull in schema',       sch.includes('onDelete: SetNull')],
  ['Fix 4 - ending guard on delete btn',       admin.includes('ending === event.roomName')],
  ['Fix 5 - events room page exists',          page],
  ['Fix 6 - typeof window SSR guard',          rs.includes("typeof window !== 'undefined'")],
  ['Trans - useTranslations works namespace',  works.includes("useTranslations('works')")],
]

let pass = 0
for (const [label, ok] of checks) {
  console.log((ok ? '✅' : '❌') + ' ' + label)
  if (ok) pass++
}
console.log('\n' + pass + '/' + checks.length + ' checks passed')
