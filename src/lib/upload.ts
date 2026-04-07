import { v4 as uuidv4 } from 'uuid';
import { uploadBufferToR2 } from '@/lib/r2Upload';

/**
 * Save an uploaded audio file to Cloudflare R2.
 * Validates MIME type and size according to env vars.
 * Returns the public URL or relative bucket key.
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

  const r2Key = `uploads/audio/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${filename}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const publicUrl = await uploadBufferToR2(buffer, r2Key, file.type);

  return publicUrl;
}
