import { NextRequest, NextResponse } from 'next/server';
import { getS3Client } from '@/lib/r2Upload';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getUserSession } from '@/lib/auth';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const session = await getUserSession();
        if (!session?.userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { fileName, fileType, folder = 'uploads' } = body;

        if (!fileName || !fileType) {
            return NextResponse.json({ error: 'Missing fileName or fileType' }, { status: 400 });
        }

        const client = getS3Client();

        // Generate a secure, unique upload path inside the requested folder
        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase();
        const r2Key = `${folder}/${session.userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME!,
            Key: r2Key,
            ContentType: fileType,
        });

        // Generate the presigned URL giving the client 60 minutes to upload the file directly to R2
        const presignedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

        // Calculate the final public URL where the file will be accessible after success
        const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
        const finalUrl = r2PublicUrl ? `${r2PublicUrl}/${r2Key}` : r2Key;

        return NextResponse.json({
            presignedUrl,
            finalUrl,
            r2Key,
        });
    } catch (error) {
        console.error('Presign URL generation failed:', error);
        return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
    }
}
