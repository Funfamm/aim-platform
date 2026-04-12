import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const {
  R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} = process.env;

// Initialize the S3 client lazily so it doesn't crash on build if env vars are missing
let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    throw new Error('[r2Upload] Missing required Cloudflare R2 environment variables.');
  }

  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  return s3Client;
}

/**
 * Uploads a raw buffer to Cloudflare R2.
 * 
 * @param buffer The file buffer (e.g. from a File.arrayBuffer())
 * @param key The absolute path inside the bucket (e.g., "uploads/123/profile.png")
 * @param mimeType The file's MIME type (e.g., "image/png"). Defaults to application/octet-stream.
 * @returns The absolute URL (if R2_PUBLIC_URL is set) or the relative key for resolution.
 */
export async function uploadBufferToR2(
  buffer: Buffer | Uint8Array,
  key: string,
  mimeType: string = 'application/octet-stream'
): Promise<string> {
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: mimeType,
  });

  await client.send(command);

  // If a public URL exists, return the absolute HTTP URL
  if (R2_PUBLIC_URL) {
    const base = R2_PUBLIC_URL.replace(/\/$/, '');
    return `${base}/${key}`;
  }

  // If no public URL is defined, return the relative bucket key. 
  // videoStorage.ts (or similar proxy routes) will be responsible for resolving this later.
  return key;
}

/**
 * Deletes one or more objects from Cloudflare R2 by their public URLs.
 * Silently skips URLs that don't match R2_PUBLIC_URL (e.g. external CDN links).
 * Never throws — failures are logged so callers can proceed with DB operations.
 *
 * @param urls  Array of full public R2 URLs (e.g. https://cdn.example.com/uploads/file.jpg)
 * @returns     { deleted: number, failed: number }
 */
export async function deleteR2Objects(urls: string[]): Promise<{ deleted: number; failed: number }> {
  const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  const bucket = process.env.R2_BUCKET_NAME;

  if (!r2PublicUrl || !bucket) return { deleted: 0, failed: 0 };

  let client: S3Client;
  try {
    client = getS3Client();
  } catch {
    return { deleted: 0, failed: urls.length };
  }

  let deleted = 0;
  let failed = 0;

  for (const url of urls) {
    if (!url || !url.startsWith(r2PublicUrl)) continue; // skip non-R2 or empty
    const key = url.slice(r2PublicUrl.length + 1); // strip base URL + leading slash
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      deleted++;
    } catch (err) {
      console.error(`[r2Upload] Failed to delete R2 object: ${key}`, err);
      failed++;
    }
  }

  return { deleted, failed };
}
