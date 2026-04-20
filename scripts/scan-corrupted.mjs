/**
 * Scans for garbled strings by looking for unexpected sequences
 * like two-byte Latin-1 misreadings of multi-byte UTF-8 emoji.
 * Looks for: strings with characters in the 0x80-0xBF range
 * (which appear as â, Ã, Å, δ, etc. in Latin-1 mis-reads).
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const msg = join(__dir, '..', 'messages')
const locales = ['en','fr','es','pt','de','ar','hi','ja','ko','zh','ru']

// These are the hex ranges that appear when UTF-8 multibyte sequences are
// read as Latin-1: U+0080–U+009F (C1 controls), or look for the specific
// garbled pattern â, Ã, Å, δ, Ÿ, ¤ combos
const GARBLE_RE = /[\u0080-\u009F]|[\u00C0-\u00FF][\u0080-\u00BF]/

for (const l of locales) {
  const raw = readFileSync(join(msg, `${l}.json`), 'utf8')
  const data = JSON.parse(raw)
  const found = []

  function scan(obj, prefix) {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string' && GARBLE_RE.test(v)) {
        found.push(`  ${prefix}.${k}: ${JSON.stringify(v).slice(0, 100)}`)
      } else if (v && typeof v === 'object') {
        scan(v, `${prefix}.${k}`)
      }
    }
  }
  scan(data, l)
  if (found.length) {
    console.log(`\n=== ${l}.json (${found.length} suspicious) ===`)
    found.forEach(f => console.log(f))
  } else {
    console.log(`${l}.json: clean`)
  }
}
