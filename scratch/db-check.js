const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
    try {
        // 1. Check if Donation and ScriptCall tables exist
        const tables = await p.$queryRawUnsafe(
            `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Donation','ScriptCall') ORDER BY table_name`
        );
        console.log('Tables found:', JSON.stringify(tables));

        // 2. Check if contentTranslations column exists on ScriptCall
        const cols = await p.$queryRawUnsafe(
            `SELECT column_name FROM information_schema.columns WHERE table_name='ScriptCall' AND column_name='contentTranslations'`
        );
        console.log('contentTranslations column exists:', cols.length > 0, JSON.stringify(cols));

        // 3. Count Donation rows
        const donCount = await p.$queryRawUnsafe(`SELECT COUNT(*)::int as cnt FROM "Donation"`);
        console.log('Donation row count:', JSON.stringify(donCount));

        // 4. Count users, subscribers, applications for email load estimate
        const users = await p.user.count();
        const verifiedUsers = await p.user.count({ where: { emailVerified: true } });
        const subscribers = await p.subscriber.count({ where: { active: true } });
        const totalApps = await p.application.count();
        const uniqueAppEmails = await p.$queryRawUnsafe(`SELECT COUNT(DISTINCT email)::int as cnt FROM "Application"`);
        console.log('Users:', users, '| Verified:', verifiedUsers, '| Active Subscribers:', subscribers);
        console.log('Total Applications:', totalApps, '| Unique applicant emails:', JSON.stringify(uniqueAppEmails));

    } catch (e) {
        console.error('ERROR:', e.message);
    } finally {
        await p.$disconnect();
    }
})();
