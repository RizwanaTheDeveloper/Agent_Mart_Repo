import { NextFunction, Request, Response } from 'express';

/** Rejects plain-HTTP requests when REQUIRE_HTTPS=true (app must sit behind a TLS proxy with trust proxy). */
export function requireHttps(req: Request, res: Response, next: NextFunction): void {
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
  res.status(403).json({ statusCode: 403, message: 'HTTPS is required', error: 'Forbidden' });
}
