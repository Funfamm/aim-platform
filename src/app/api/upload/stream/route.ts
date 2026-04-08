import { NextRequest, NextResponse } from 'next/server';
import { getS3Client } from '@/lib/r2Upload';
import { PutObjectCommand } from '@aws-sdk/client-s3';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds — allow large file streaming
// NextRequest.body is a ReadableStream — no body-parser involved, no 4.5MB cap.
// Vercel's limit only applies to request.json() / request.formData() parsing.

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;  // 10 MB
const MAX_VOICE_SIZE = 50 * 1024 * 1024;  // 50 MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
    try {
        // Metadata comes from query params (tiny — never hits body parser limit)
        const { searchParams } = new URL(req.url);
        const fileName  = searchParams.get('fileName');
        const fileType  = searchParams.get('fileType');
        const folder    = searchParams.get('folder') || 'uploads';
        const fileSize  = parseInt(searchParams.get('fileSize') || '0', 10);

        if (!fileName || !fileType) {
            return NextResponse.json({ error: 'Missing fileName or fileType query params' }, { status: 400 });
        }

        // Size guard before we even read the body
        const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
        const effectiveSize = contentLength || fileSize;
        if (effectiveSize > MAX_TOTAL_SIZE) {
            return NextResponse.json({ error: `File too large (max ${MAX_TOTAL_SIZE / 1024 / 1024}MB)` }, { status: 413 });
        }

        const isAudio = fileType.startsWith('audio/');
        const limit = isAudio ? MAX_VOICE_SIZE : MAX_PHOTO_SIZE;
        if (effectiveSize > limit) {
            return NextResponse.json({
                error: `File too large (max ${limit / 1024 / 1024}MB for ${isAudio ? 'audio' : 'photos'})`,
            }, { status: 413 });
        }

        // Sanitize path
        const safeFolder = folder
            .replace(/\.\./g, '')
            .replace(/[^a-zA-Z0-9/_-]/g, '')
            .replace(/\/+/g, '/')
            .replace(/^\/|\/$/g, '') || 'uploads';

        const ext = fileName.includes('.')
            ? '.' + (fileName.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
            : '';
        const baseName = fileName
            .replace(/\.[^.]+$/, '')
            .replace(/[^a-zA-Z0-9-]/g, '_')
            .toLowerCase()
            .slice(0, 40);

        const r2Key = `${safeFolder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${baseName}${ext}`;

        // Stream the raw body directly to R2 — no buffering, no body-parser limit
        if (!req.body) {
            return NextResponse.json({ error: 'No body provided' }, { status: 400 });
        }

        // Convert ReadableStream to a Buffer (Node.js streams work fine on Vercel serverless)
        const chunks: Uint8Array[] = [];
        const reader = req.body.getReader();
        let totalBytes = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.byteLength;
            if (totalBytes > MAX_TOTAL_SIZE) {
                return NextResponse.json({ error: 'File too large' }, { status: 413 });
            }
            chunks.push(value);
        }

        const buffer = Buffer.concat(chunks);

        const client = getS3Client();
        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: r2Key,
            Body: buffer,
            ContentType: fileType,
            ContentLength: buffer.byteLength,
        });

        await client.send(command);

        // Build final URL
        const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
        const finalUrl = r2PublicUrl ? `${r2PublicUrl}/${r2Key}` : r2Key;

        return NextResponse.json({ finalUrl, r2Key });

    } catch (error) {
        console.error('[upload/stream] Upload failed:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
