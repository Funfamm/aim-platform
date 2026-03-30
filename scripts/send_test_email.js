// scripts/send_test_email.js
// Standalone script: sends a test email via Microsoft Graph API
// Uses the same AZURE_* env vars from .env
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');

// Load .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  // Strip surrounding quotes
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  if (!process.env[key]) process.env[key] = val;
}

const prisma = new PrismaClient();

async function getGraphToken() {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  console.log('Azure config:');
  console.log('  TENANT_ID:', tenantId ? tenantId.slice(0, 8) + '...' : '❌ MISSING');
  console.log('  CLIENT_ID:', clientId ? clientId.slice(0, 8) + '...' : '❌ MISSING');
  console.log('  CLIENT_SECRET:', clientSecret ? clientSecret.slice(0, 8) + '...' : '❌ MISSING');

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing AZURE_TENANT_ID, AZURE_CLIENT_ID, or AZURE_CLIENT_SECRET');
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams();
  body.append('client_id', clientId);
  body.append('client_secret', clientSecret);
  body.append('scope', 'https://graph.microsoft.com/.default');
  body.append('grant_type', 'client_credentials');

  console.log('\n📡 Requesting Graph access token...');
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error('❌ Token request failed:', response.status);
    console.error('Response:', raw);
    throw new Error(`Token request failed: ${response.status}`);
  }

  const data = JSON.parse(raw);
  console.log('✅ Got access token (expires in', data.expires_in, 'seconds)');
  return data.access_token;
}

async function sendMail(token, fromEmail, toEmail) {
  const url = `https://graph.microsoft.com/v1.0/users/${fromEmail}/sendMail`;
  console.log(`\n📧 Sending email from ${fromEmail} to ${toEmail}...`);
  console.log('   Graph URL:', url);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        subject: '✅ AIM Studio | Email Test Successful',
        body: {
          contentType: 'HTML',
          content: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
              <h2 style="color: #d4a853; margin-bottom: 8px;">Email Configuration Working!</h2>
              <p style="color: #999; font-size: 14px;">Your AIM Studio email settings are correctly configured.</p>
              <p style="color: #666; font-size: 12px; margin-top: 24px;">Sender: ${fromEmail}</p>
              <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toISOString()}</p>
            </div>
          `,
        },
        toRecipients: [{ emailAddress: { address: toEmail } }],
        from: { emailAddress: { address: fromEmail, name: 'AIM Studio' } },
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('❌ Send failed:', response.status);
    console.error('Response:', err);
    throw new Error(`sendMail failed: ${response.status} ${err}`);
  }

  console.log('✅ Email sent successfully!');
}

async function main() {
  // Step 1: Read DB settings to get sender email
  const settings = await prisma.siteSettings.findFirst({
    select: { emailsEnabled: true, smtpFromEmail: true, smtpUser: true },
  });
  console.log('DB settings:', settings);

  const fromEmail = settings?.smtpFromEmail || settings?.smtpUser || 'aimstudio@impactaistudio.com';
  const toEmail = 'aimstudio@impactaistudio.com';

  // Step 2: Get Graph token
  const token = await getGraphToken();

  // Step 3: Send email
  await sendMail(token, fromEmail, toEmail);
}

main()
  .catch(e => {
    console.error('\n💥 Fatal error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
