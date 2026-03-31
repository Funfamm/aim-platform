// scripts/enable_email.js
// Enable email sending and configure the Graph-based mailer correctly.
// The actual Graph auth uses AZURE_* env vars. The DB fields store sender info.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.siteSettings.update({
    where: { id: 'default' },
    data: {
      emailsEnabled: true,
      smtpHost: 'graph.microsoft.com',       // not really SMTP, but marks it as configured
      smtpPort: 443,
      smtpUser: 'aimstudio@impactaistudio.com',  // sender email (must be a licensed mailbox in Azure AD)
      smtpPass: 'PLACEHOLDER_NOT_A_REAL_PASSWORD',  // Auth handled via AZURE_CLIENT_SECRET env var
      smtpFromName: 'AIM Studio',
      smtpFromEmail: 'aimstudio@impactaistudio.com',
      smtpSecure: true,
    },
  });
  console.log('✅ Email settings updated:', {
    emailsEnabled: updated.emailsEnabled,
    smtpFromEmail: updated.smtpFromEmail,
    smtpFromName: updated.smtpFromName,
  });
}

main()
  .catch(e => {
    console.error('❌ Error:', e.message || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
