import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { saveAudioFile } from '@/lib/upload';
import { validateAudio } from '@/middleware/validateAudio';
import { rateLimitCasting } from '@/middleware/rateLimitCasting';
import { logger } from '@/lib/logger';

// BullMQ is optional — only used when REDIS_URL is set.
// Do NOT instantiate Queue at module level (causes ECONNREFUSED during build/static-gen).

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateResult = await rateLimitCasting(request);
  if (rateResult) return rateResult;

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Invalid content type. Expected multipart/form-data.' }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    return NextResponse.json({ error: 'Failed to parse form data.' }, { status: 400 });
  }

  // Validate audio upload
  const validationResult = await validateAudio(form);
  if (validationResult) return validationResult;

  const audioFile = form.get('audio') as File;

  // Extract other fields
  const name = form.get('name')?.toString() ?? '';
  const email = form.get('email')?.toString() ?? '';
  const phone = form.get('phone')?.toString() ?? '';
  const experience = form.get('experience')?.toString() ?? '';
  const castingCallId = form.get('castingCallId')?.toString();

  if (!castingCallId) {
    return NextResponse.json({ error: 'Missing castingCallId' }, { status: 400 });
  }

  // Save audio file and get public URL
  let audioUrl: string;
  try {
    audioUrl = await saveAudioFile(audioFile);
  } catch (err) {
    logger.error('castingSubmit', 'Audio upload failed', { error: err });
    return NextResponse.json({ error: 'Failed to store audio file' }, { status: 500 });
  }

  // Create casting application record
  const application = await prisma.application.create({
    data: {
      castingCallId,
      fullName: name,
      email,
      phone: phone || null,
      experience,
      audioUrl: audioUrl || null,
    },
  });

  logger.info('castingSubmit', `Application ${application.id} created`);

  // Enqueue background processing only when Redis is available
  if (process.env.REDIS_URL) {
    try {
      const { Queue } = await import('bullmq');
      const parsedUrl = new URL(process.env.REDIS_URL);
      const isTls = process.env.REDIS_URL.startsWith('rediss://');
      const audioQueue = new Queue('audioProcessingQueue', {
        connection: {
          host: parsedUrl.hostname,
          port: parseInt(parsedUrl.port || '6379', 10),
          ...(parsedUrl.password ? { password: decodeURIComponent(parsedUrl.password) } : {}),
          ...(isTls ? { tls: {} } : {}),
        },
      });
      await audioQueue.add('process', { applicationId: application.id, audioUrl });
    } catch (err) {
      logger.warn('castingSubmit', 'Failed to enqueue audio processing job', { error: err });
    }
  }

  return NextResponse.json(
    { submissionId: application.id, message: 'Application received' },
    { status: 202 }
  );
}
