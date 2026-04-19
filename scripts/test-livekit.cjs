// Check all Live Events and test LiveKit connection
const fs = require('fs');
const envLines = fs.readFileSync('.env', 'utf8').split('\n');
for (const line of envLines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
}

const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    // 1. Check all live events
    const events = await p.liveEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
    });
    
    console.log(`\n═══ Live Events (${events.length}) ═══`);
    for (const e of events) {
        console.log(`  ${e.id} | ${e.status.padEnd(10)} | ${e.roomName.padEnd(25)} | ${e.title}`);
        console.log(`    type=${e.eventType} host=${e.hostUserId} project=${e.projectId || 'none'}`);
    }

    // 2. Test LiveKit Cloud connectivity
    const LIVEKIT_URL = process.env.LIVEKIT_URL;
    const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
    const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
    
    console.log(`\n═══ LiveKit Config ═══`);
    console.log(`  URL: ${LIVEKIT_URL}`);
    console.log(`  API Key: ${LIVEKIT_API_KEY?.slice(0, 6)}...`);
    console.log(`  API Secret: ${LIVEKIT_API_SECRET?.slice(0, 6)}...`);

    // 3. Test RoomServiceClient
    try {
        const { RoomServiceClient } = require('livekit-server-sdk');
        const httpsUrl = LIVEKIT_URL.replace(/^wss?:\/\//, 'https://');
        const roomSvc = new RoomServiceClient(httpsUrl, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
        
        console.log(`\n═══ LiveKit Room Service Test ═══`);
        console.log(`  Connecting to: ${httpsUrl}`);
        
        const rooms = await roomSvc.listRooms();
        console.log(`  ✅ Connected! Active rooms: ${rooms.length}`);
        for (const r of rooms) {
            console.log(`    Room: ${r.name} | participants: ${r.numParticipants} | created: ${new Date(Number(r.creationTime) * 1000).toISOString()}`);
        }
    } catch (err) {
        console.log(`  ❌ LiveKit connection failed: ${err.message}`);
        if (err.message.includes('401') || err.message.includes('unauthorized')) {
            console.log('    → API key/secret mismatch or expired');
        } else if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
            console.log('    → LiveKit URL hostname cannot be resolved');
        } else if (err.message.includes('ECONNREFUSED')) {
            console.log('    → LiveKit server not reachable');
        }
    }

    // 4. Test token generation
    try {
        const { AccessToken } = require('livekit-server-sdk');
        const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
            identity: 'test-user',
            name: 'Test User',
            ttl: '30s',
        });
        at.addGrant({
            roomJoin: true,
            room: 'test-diagnostic-room',
            canSubscribe: true,
            canPublish: false,
        });
        const token = await at.toJwt();
        console.log(`\n═══ Token Generation Test ═══`);
        console.log(`  ✅ Token generated: ${token.slice(0, 40)}...`);
        console.log(`  Length: ${token.length} chars`);
    } catch (err) {
        console.log(`\n═══ Token Generation Test ═══`);
        console.log(`  ❌ Failed: ${err.message}`);
    }

    await p.$disconnect();
}

main().catch(err => {
    console.error('Script error:', err);
    process.exit(1);
});
