import { readFileSync, writeFileSync } from 'fs'

const f = 'src/lib/email-i18n.ts'
let c = readFileSync(f, 'utf8')

// Fix 1: castingStatus_selected en line - notifMessage with unescaped curly quotes
// "You've been selected for "{role}"" => use escaped or single-quote wrapper
c = c.replace(
  `notifMessage: "Congratulations! You've been selected for \\"{role}\\". Welcome aboard!"`,
  `notifMessage: 'Congratulations! You\\'ve been selected for "{role}". Welcome aboard!'`
)

// Fix 2: castingWithdrawal en line - body with unescaped " around {role}
// body: "Your application for the "{role}" role..."
c = c.replace(
  `body: "Your application for the \\"{role}\\" role has been successfully withdrawn. If you change your mind, you can reapply anytime while the role is still open."`,
  `body: 'Your application for the \\"{role}\\" role has been successfully withdrawn. If you change your mind, you can reapply anytime while the role is still open.'`
)

// Fix 3: scan for remaining unescaped double-quoted {role} inside double-quoted strings
// Pattern: containing "{role}" inside a double-quoted value
// Report them
const lines = c.split('\n')
const issues = []
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  // Look for: ": "..."{role}"..." (unescaped quote before {role} inside double-quoted string)
  if (/"[^"]*"{role}"[^"]*"/.test(line)) {
    issues.push({ line: i + 1, content: line.trim().substring(0, 120) })
  }
}

if (issues.length > 0) {
  console.log('Remaining issues:')
  issues.forEach(({ line, content }) => console.log(`  Line ${line}: ${content}`))
} else {
  console.log('No remaining unescaped quote issues found.')
}

writeFileSync(f, c)
console.log('Done.')
