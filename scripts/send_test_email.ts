// Temporary script to send a test email using the mailer utility
import { sendTestEmail } from '@/lib/mailer';

(async () => {
  const to = 'test@example.com'; // replace with a real address if desired
  try {
    await sendTestEmail(to);
    console.log('✅ Test email sent to', to);
  } catch (err) {
    console.error('❌ Failed to send test email:', err);
  }
})();
