const fs = require('fs')
let c = fs.readFileSync('src/lib/email-i18n.ts', 'utf8')
// The script inserted with a Unix \n — find the broken line and fix the quote style
c = c.replace(
  "subject:    'You\u2019re subscribed to AIM Studio! \uD83C\uDFAC',",
  "subject:    \"You're subscribed to AIM Studio! \uD83C\uDFAC\","
)
// Also fix using straight apostrophe variant (the actual broken one)
c = c.replace(
  "subject:    'You're subscribed to AIM Studio! \uD83C\uDFAC',",
  "subject:    \"You're subscribed to AIM Studio! \uD83C\uDFAC\","
)
fs.writeFileSync('src/lib/email-i18n.ts', c)
process.stdout.write('Fixed\n')
