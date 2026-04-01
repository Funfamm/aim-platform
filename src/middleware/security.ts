import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { NextApiRequest, NextApiResponse } from 'next';

export const securityMiddleware = (handler: (req: NextApiRequest, res: NextApiResponse) => any) => async (req: NextApiRequest, res: NextApiResponse) => {
  // Helmet defaults (CSP, HSTS, Referrer‑Policy, etc.)
  await helmet()(req as any, res as any, () => {});
  // Rate limiting – 100 requests per minute per IP
  await rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  })(req as any, res as any, () => {});
  return handler(req, res);
};
