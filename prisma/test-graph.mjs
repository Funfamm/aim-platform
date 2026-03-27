// Test: Get a Graph API token and check if the mailbox is accessible
import { config } from 'dotenv';
config();

const tenantId = process.env.AZURE_TENANT_ID;
const clientId = process.env.AZURE_CLIENT_ID;
const clientSecret = process.env.AZURE_CLIENT_SECRET;
const fromEmail = 'noreply@impactaistudio.com';

async function main() {
  console.log('Getting Graph token...');
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('Token error:', JSON.stringify(data));
    return;
  }
  console.log('✅ Token obtained. Expires in', data.expires_in, 'seconds');

  // Try to list the mailbox
  const me = await fetch(`https://graph.microsoft.com/v1.0/users/${fromEmail}`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const meData = await me.json();
  console.log('Mailbox check:', me.status, JSON.stringify(meData).slice(0, 200));
}

main().catch(console.error);
