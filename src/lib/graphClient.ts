/// <reference lib="dom" />
// Using global fetch (available in Node 18+)

// Load credentials from environment variables
// Load credentials lazily – no crash at import time
function getCredentials() {
  const tenantId = process.env.AZURE_TENANT_ID;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Missing Azure AD credentials (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET)');
  }
  return { tenantId, clientId, clientSecret };
}

let cachedToken: string | null = null;
let tokenExpiresAt = 0; // epoch ms

/**
 * Retrieves an access token for Microsoft Graph using client credentials flow.
 * Caches the token until it expires (typically 1 hour).
 */
export async function getGraphAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    // Return cached token if still valid (with 1 minute buffer)
    return cachedToken;
  }

  const { tenantId, clientId, clientSecret } = getCredentials();
  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams();
  body.append('client_id', clientId!);
  body.append('client_secret', clientSecret!);
  body.append('scope', 'https://graph.microsoft.com/.default');
  body.append('grant_type', 'client_credentials');

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const raw = await response.text();
  if (!response.ok) {
    console.error('Graph token request failed:', response.status, raw);
    throw new Error(`Failed to obtain Graph access token: ${response.status}`);
  }
  const data = JSON.parse(raw) as { access_token: string; expires_in: number };

  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000;
  return cachedToken;
}
