import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { IncomingMessage, ServerResponse } from 'http';

type Handler = (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void;

export const securityMiddleware = (handler: Handler) =>
  async (req: NextApiRequest, res: NextApiResponse) => {
    // Helmet defaults (CSP, HSTS, Referrer-Policy, etc.)
    await helmet()(req as unknown as IncomingMessage, res as unknown as ServerResponse, () => {});
    // Rate limiting – 100 requests per minute per IP
    await rateLimit({
      windowMs: 60_000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    })(req as unknown as IncomingMessage, res as unknown as ServerResponse, () => {});
    return handler(req, res);
  };
