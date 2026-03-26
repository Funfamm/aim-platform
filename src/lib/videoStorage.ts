/**
 * videoStorage.ts
 *
 * Server-side utility for generating signed URLs for video files stored in Cloudflare R2.
 * Uses Node.js built-in `crypto` (available in Next.js server/API routes).
 *
 * ENV VARS REQUIRED
 * -----------------
 * R2_ACCOUNT_ID         – Cloudflare account ID (found in the dashboard sidebar)
 * R2_ACCESS_KEY_ID      – R2 API token Access Key ID
 * R2_SECRET_ACCESS_KEY  – R2 API token Secret Access Key
 * R2_BUCKET_NAME        – Name of the R2 bucket (e.g. "aim-platform-videos")
 * R2_PUBLIC_URL         – (optional) Public base URL if the bucket has public access enabled
 *                         e.g. "https://pub-<hash>.r2.dev"
 */

import { createHmac, createHash } from 'crypto';

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = process.env;

/** Expiry duration for signed URLs (seconds). Default: 2 hours. */
const SIGNED_URL_TTL = 60 * 60 * 2;

function getR2Endpoint(): string {
  if (!R2_ACCOUNT_ID) throw new Error('[videoStorage] R2_ACCOUNT_ID is not set');
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function sha256hex(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Generates an AWS SigV4 pre-signed URL for an object in a Cloudflare R2 bucket.
 *
 * @param key  Object key (path) inside the bucket, e.g. "movies/my-film.mp4"
 * @param ttl  URL validity in seconds (default: 2 hours)
 */
export async function getSignedVideoUrl(key: string, ttl = SIGNED_URL_TTL): Promise<string> {
  // Fast path: if public URL is configured, just return a direct link
  if (R2_PUBLIC_URL) {
    const base = R2_PUBLIC_URL.replace(/\/$/, '');
    return `${base}/${encodeURIComponent(key)}`;
  }

  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error(
      '[videoStorage] Missing R2 env vars. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME.'
    );
  }

  const endpoint = getR2Endpoint();
  const region = 'auto';
  const service = 's3';

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';

  const host = new URL(endpoint).host;
  const path = `/${R2_BUCKET_NAME}/${key}`;
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${R2_ACCESS_KEY_ID}/${credentialScope}`;

  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(ttl),
    'X-Amz-SignedHeaders': 'host',
  });

  const canonicalRequest = [
    'GET',
    path,
    queryParams.toString(),
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256hex(canonicalRequest),
  ].join('\n');

  const signingKey = hmac(
    hmac(
      hmac(
        hmac(`AWS4${R2_SECRET_ACCESS_KEY}`, dateStamp),
        region
      ),
      service
    ),
    'aws4_request'
  );

  const signature = hmac(signingKey, stringToSign).toString('hex');

  queryParams.set('X-Amz-Signature', signature);

  return `${endpoint}${path}?${queryParams.toString()}`;
}

/**
 * Convenience wrapper: resolves any raw video value from the DB into a URL
 * safe to use in a <video src="..."> tag.
 *
 * - Absolute http(s) URL  → returned as-is
 * - R2 object key         → generates a signed URL
 * - Relative path         → returned as-is (local dev fallback)
 */
export async function resolveVideoUrl(rawValue: string): Promise<string> {
  if (!rawValue) return '';
  if (rawValue.startsWith('http://') || rawValue.startsWith('https://')) return rawValue;
  if (R2_BUCKET_NAME) return getSignedVideoUrl(rawValue);
  return rawValue;
}
