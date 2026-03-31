import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { encrypt } from '@/lib/secure';

/**
 * Save an uploaded audio file to the local filesystem.
 * Validates MIME type and size according to env vars.
 * Returns the public URL (relative to the site root).
 */
export async function saveAudioFile(file: File): Promise<string> {
  const allowedMimes = ['audio/mpeg', 'audio/wav'];
  const maxSize = Number(process.env.MAX_AUDIO_SIZE) || 10 * 1024 * 1024; // 10 MB default

  if (!allowedMimes.includes(file.type)) {
    throw new Error('Invalid audio format. Only MP3 and WAV are allowed.');
  }
  if (file.size > maxSize) {
    throw new Error(`Audio file exceeds maximum size of ${maxSize} bytes.`);
  }

  const ext = file.type === 'audio/mpeg' ? 'mp3' : 'wav';
  const filename = `${uuidv4()}.${ext}`;
  const date = new Date();
  const folder = path.join('public', 'uploads', `${date.getFullYear()}`, `${String(date.getMonth() + 1).padStart(2, '0')}`, `${String(date.getDate()).padStart(2, '0')}`);
  await fs.promises.mkdir(folder, { recursive: true });
  const filePath = path.join(folder, filename);

  // Node's File object from FormData is a Blob; we need to stream it to disk.
  const arrayBuffer = await file.arrayBuffer();
  await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));

  // Return the URL that can be served statically (Next.js will expose /public)
  const publicUrl = `/uploads/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${filename}`;
  return publicUrl;
}
