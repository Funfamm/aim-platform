// scripts/test_email.js
// Directly invoke the mailer to send a test email after enabling SMTP settings.
const path = require('path');
const { sendTestEmail } = require(path.join(__dirname, '..', 'src', 'lib', 'mailer'));

const to = 'aimstudio@impactaistudio.com'; // test recipient

(async () => {
  try {
    await sendTestEmail(to);
    console.log('✅ Test email sent to', to);
  } catch (err) {
    console.error('❌ Failed to send test email:', err);
  }
})();
