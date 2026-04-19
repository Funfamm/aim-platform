// Clear all stuck subtitle jobs so new ones can be created
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
(async () => {
    const stuck = await p.subtitleJob.findMany({ where: { status: { in: ['queued', 'processing'] } } });
    console.log('Stuck jobs:', stuck.length);
    for (const j of stuck) console.log('  ', j.id, j.status, j.projectId, j.sourceVideoUrl?.slice(-40));
    
    if (stuck.length > 0) {
        const r = await p.subtitleJob.updateMany({
            where: { status: { in: ['queued', 'processing'] } },
            data: { status: 'failed', errorMessage: 'Reset: cleared stuck job to allow retry' }
        });
        console.log('Cleared', r.count, 'stuck jobs');
    }
    
    // Also show all jobs for context
    const all = await p.subtitleJob.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
    console.log('\nRecent jobs:');
    for (const j of all) console.log('  ', j.id, j.status, j.projectId);
    
    await p.$disconnect();
})();
