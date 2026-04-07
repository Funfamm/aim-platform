import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from '@aws-sdk/client-s3';

const client = new S3Client({
  region: 'auto',
  endpoint: 'https://3d54b5f5fa04f4253e89f848ed2ac8a8.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: '7dc465c5941a493951542d35fe16e451',
    secretAccessKey: 'f05767812cf6dbd073272069c1846789963a8d5579c0b0b4d7a6195eff39ce55',
  },
});

const BUCKET = 'aim-platform-videos';

const corsConfig = {
  CORSRules: [
    {
      // Allow browser direct uploads (presigned PUT) from all our domains
      AllowedOrigins: [
        'https://aim-platform-aiimpactmediastudio-7781s-projects.vercel.app',
        'https://impactaistudio.com',
        'https://www.impactaistudio.com',
        'http://localhost:3000',
      ],
      AllowedMethods: ['PUT', 'GET', 'HEAD'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag'],
      MaxAgeSeconds: 3600,
    },
  ],
};

try {
  console.log('Setting CORS on bucket:', BUCKET);
  await client.send(new PutBucketCorsCommand({
    Bucket: BUCKET,
    CORSConfiguration: corsConfig,
  }));
  console.log('✅ CORS set successfully!');

  // Verify
  const result = await client.send(new GetBucketCorsCommand({ Bucket: BUCKET }));
  console.log('Verified CORS rules:', JSON.stringify(result.CORSRules, null, 2));
} catch (err) {
  console.error('❌ Failed:', err.message);
}
