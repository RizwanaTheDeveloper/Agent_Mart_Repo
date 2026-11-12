import { createHash, randomBytes } from 'crypto';

/** 256-bit opaque bearer token. */
export const generateToken = (): string => randomBytes(32).toString('base64url');

/** Only the SHA-256 of a token is persisted. */
export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export const sha256 = (data: string): string => createHash('sha256').update(data).digest('hex');
