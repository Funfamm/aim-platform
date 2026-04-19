// Test the callback endpoint with bypass header and HMAC signature
const https = require('https');
const crypto = require('crypto');

const SECRET = 'ef674a5892ac4f9b84d9f0de37f2a1b5';
const BYPASS = '45f722dcb82e631ebd2df70b7f67e4f4aa9178f41ab1c981576338d086a00aa0';

const payload = JSON.stringify({ jobId: 'test-probe', workerRunId: 'probe-1' });
const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');

console.log('Testing callback with:');
console.log('  Secret fingerprint:', SECRET.slice(0, 4) + '...' + SECRET.slice(-4));
console.log('  Bypass fingerprint:', BYPASS.slice(0, 4) + '...' + BYPASS.slice(-4));
console.log('  Signature:', sig.slice(0, 16) + '...');
console.log('  Body:', payload);

const req = https.request({
    hostname: 'aim-platform-aiimpactmediastudio-7781s-projects.vercel.app',
    path: '/api/subtitle-worker-callback',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Signature': sig,
        'x-vercel-protection-bypass': BYPASS,
        'Content-Length': Buffer.byteLength(payload),
    }
}, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
        console.log('\nResponse:', res.statusCode);
        // Check if we got HTML (SSO wall) or JSON (actual endpoint)
        if (data.includes('<html') || data.includes('Vercel Authentication')) {
            console.log('❌ Got Vercel SSO page — bypass header NOT working');
        } else {
            console.log('✅ Got API response:', data.slice(0, 200));
        }
    });
});
req.write(payload);
req.end();
