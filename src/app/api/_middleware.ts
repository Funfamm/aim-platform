import { securityMiddleware } from '@/middleware/security';
import type { NextApiRequest, NextApiResponse } from 'next';

// This middleware will be applied to all API routes under /api
export default securityMiddleware(async (req: NextApiRequest, res: NextApiResponse) => {
  // No-op handler – the actual route handler will run after this wrapper.
});
