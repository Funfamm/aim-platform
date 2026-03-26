import 'dotenv/config';
import { sendTestEmail } from './src/lib/mailer';

(async () => {
  try {
    const recipient = process.env.TEST_EMAIL_RECIPIENT || 'aimstudio@impactaistudio.com';
    await sendTestEmail(recipient);
    console.log('✅ Test email sent successfully');
  } catch (err) {
    console.error('❌ Test email failed:', err);
  }
})();
