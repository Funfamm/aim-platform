import { NextRequest, NextResponse } from 'next/server';
import { getS3Client } from '@/lib/r2Upload';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { fileName, fileType, folder = 'uploads' } = body;

        if (!fileName || !fileType) {
            return NextResponse.json({ error: 'Missing fileName or fileType' }, { status: 400 });
        }

        // Sanitize the folder path — only allow safe path characters, no traversal
        const safeFolder = folder
            .replace(/\.\./g, '')
            .replace(/[^a-zA-Z0-9/_-]/g, '')
            .replace(/\/+/g, '/')
            .replace(/^\/|\/$/g, '') || 'uploads'

        const client = getS3Client();

        // Preserve the file extension, sanitize the rest of the name, add a unique prefix
        const ext = fileName.includes('.')
            ? '.' + (fileName.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
            : ''
        const baseName = fileName
            .replace(/\.[^.]+$/, '')
            .replace(/[^a-zA-Z0-9-]/g, '_')
            .toLowerCase()
            .slice(0, 40)
        // Key: folder/timestamp-uuid-sanitizedname.ext
        // The folder already contains the applicant name (built by the form), e.g.:
        //   applications/john-doe-2026-04-07/photos
        //   applications/john-doe-2026-04-07/voice
        const r2Key = `${safeFolder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${baseName}${ext}`;

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: r2Key,
            ContentType: fileType,
        });

        // Presigned PUT URL — 60 minutes is plenty for the client to complete the upload
        const presignedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

        // Final URL where the file is accessible after upload (permanent if R2_PUBLIC_URL is set)
        const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
        const finalUrl = r2PublicUrl ? `${r2PublicUrl}/${r2Key}` : r2Key;

        return NextResponse.json({ presignedUrl, finalUrl, r2Key });
    } catch (error) {
        console.error('Presign URL generation failed:', error);
        return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
    }
}
