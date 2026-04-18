/**
 * Copies @ffmpeg/core WASM files into public/ffmpeg/ so they can be served
 * self-hosted, eliminating any CDN/adblocker failures in the browser.
 * Runs automatically via the postinstall script.
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const srcDir = join(root, 'node_modules', '@ffmpeg', 'core', 'dist', 'umd')
const dstDir = join(root, 'public', 'ffmpeg')

const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm']

if (!existsSync(srcDir)) {
  console.warn('[copy-ffmpeg-wasm] @ffmpeg/core not found in node_modules — skipping.')
  process.exit(0)
}

mkdirSync(dstDir, { recursive: true })

for (const file of files) {
  const src = join(srcDir, file)
  const dst = join(dstDir, file)
  copyFileSync(src, dst)
  console.log(`[copy-ffmpeg-wasm] Copied ${file} → public/ffmpeg/`)
}

console.log('[copy-ffmpeg-wasm] Done. FFmpeg WASM is self-hosted at /ffmpeg/')
