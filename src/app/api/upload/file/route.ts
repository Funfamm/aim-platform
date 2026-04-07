import { NextRequest, NextResponse } from 'next/server';
import { getS3Client } from '@/lib/r2Upload';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getUserSession } from '@/lib/auth';

export const maxDuration = 60; // seconds
export const dynamic = 'force-dynamic';
// Disable the default 4.5MB body parser limit so large files can stream through
export const fetchCache = 'force-no-store';

export async function POST(req: NextRequest) {
    try {
        const session = await getUserSession();
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const folder = (formData.get('folder') as string) || 'uploads';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const MAX_SIZE = 50 * 1024 * 1024; // 50MB
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 413 });
        }

        const client = getS3Client();

        // Generate a secure, unique upload path
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
        const r2Key = `${folder}/${session.userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;

        // Convert file to buffer and upload server-side (no CORS needed)
        const buffer = await file.arrayBuffer();

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: r2Key,
            Body: Buffer.from(buffer),
            ContentType: file.type || 'application/octet-stream',
        });

        await client.send(command);

        // Build the public URL
        const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
        const finalUrl = r2PublicUrl ? `${r2PublicUrl}/${r2Key}` : r2Key;

        return NextResponse.json({ finalUrl, r2Key });
    } catch (error) {
        console.error('[upload/file] Upload failed:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
