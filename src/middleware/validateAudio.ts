import { NextResponse } from 'next/server';

/**
 * Middleware to validate an uploaded audio file in a multipart/form-data request.
 * Returns a NextResponse with status 400 if validation fails, otherwise
 * returns the original request (so the handler can continue).
 */
export async function validateAudio(form: FormData): Promise<NextResponse | null> {
  const audioFile = form.get('audio') as File | null;
  if (!audioFile) {
    return NextResponse.json({ error: 'Missing audio file.' }, { status: 400 });
  }

  const allowedMimes = ['audio/mpeg', 'audio/wav'];
  const maxSize = Number(process.env.MAX_AUDIO_SIZE) || 10 * 1024 * 1024; // 10 MB default

  if (!allowedMimes.includes(audioFile.type)) {
    return NextResponse.json({ error: 'Invalid audio format. Only MP3 and WAV are allowed.' }, { status: 400 });
  }
  if (audioFile.size > maxSize) {
    return NextResponse.json({ error: `Audio file exceeds maximum size of ${maxSize} bytes.` }, { status: 400 });
  }

  // Validation passed – return null to indicate no early response.
  return null;
}
