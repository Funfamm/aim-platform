import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { saveAudioFile } from '@/lib/upload';
import { validateAudio } from '@/middleware/validateAudio';
import { rateLimitCasting } from '@/middleware/rateLimitCasting';
import { logger } from '@/lib/logger';
import { Queue } from 'bullmq';

// Initialize BullMQ queue (optional background processing)
const audioQueue = new Queue('audioProcessingQueue');

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateResult = await rateLimitCasting(request);
  if (rateResult) return rateResult;

  // Validate audio upload
  const validationResult = await validateAudio(request);
  if (validationResult) return validationResult;

  const form = await request.formData();
  const audioFile = form.get('audio') as File;

  // Extract other fields (adjust as needed for your form)
  const name = form.get('name')?.toString() ?? '';
  const email = form.get('email')?.toString() ?? '';
  const phone = form.get('phone')?.toString() ?? '';
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
      phone,
      audioUrl,
    },
  });

  // Audit log entry
  await prisma.castingApplicationLog.create({
    data: {
      userId: null, // fill if you have auth context
      status: 'pending',
      audioUrl,
    },
  });

  // Enqueue background processing (currently a no‑op but ready for future transcoding)
  await audioQueue.add('process', { applicationId: application.id, audioUrl });

  logger.info('castingSubmit', `Application ${application.id} received`);
  return NextResponse.json(
    { submissionId: application.id, message: 'Application received' },
    { status: 202 }
  );
}
