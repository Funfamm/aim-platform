// Quick test: send a real email via Graph API to confirm it works
import { config } from 'dotenv';
config();

const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;
const fromEmail = 'aimstudio@impactaistudio.com';
const toEmail = 'aimstudio@impactaistudio.com'; // send to yourself

async function getToken() {
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.access_token;
}

async function main() {
  const token = await getToken();
  console.log('✅ Token OK');

  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${fromEmail}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: '✅ AIM Studio Email Test',
        body: { contentType: 'HTML', content: '<p>Email is working from production! 🎉</p>' },
        toRecipients: [{ emailAddress: { address: toEmail } }],
        from: { emailAddress: { address: fromEmail, name: 'AIM Studio' } },
      },
    }),
  });

  if (res.status === 202) {
    console.log('✅ Email sent successfully!');
  } else {
    const err = await res.text();
    console.error('❌ Send failed:', res.status, err);
  }
}

main().catch(console.error);
