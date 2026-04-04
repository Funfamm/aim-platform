export const PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
export const ENABLE_HTTP_FALLBACK = process.env.ENABLE_HTTP_FALLBACK !== 'false' // default true
export const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS) || 5000
