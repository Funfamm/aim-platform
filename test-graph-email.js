require('dotenv').config();
require('ts-node').register({ transpileOnly: true });
require('tsconfig-paths').register();
const { sendTestEmail } = require('./src/lib/mailer');

(async () => {
  try {
    const testRecipient = process.env.TEST_EMAIL_RECIPIENT || 'aimstudio@impactaistudio.com';
    await sendTestEmail(testRecipient);
    console.log('✅ Test email sent successfully');
  } catch (err) {
    console.error('❌ Test email failed:', err);
  }
})();
