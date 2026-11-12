import { AdminRole } from '@prisma/client';
import { Request } from 'express';

/** Authenticated administrator attached to every non-public request by SessionAuthGuard. */
export interface AdminContext {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  sessionId: string;
  sessionExpiresAt: Date;
  elevatedUntil: Date | null;
  ip: string | null;
  userAgent: string | null;
}

export type AuthedRequest = Request & { admin?: AdminContext };
