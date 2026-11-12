import { Platform } from 'react-native';

/**
 * Backend origin (no trailing slash, no /api suffix).
 * Set EXPO_PUBLIC_API_URL in .env (dev) or in your EAS build profile (production).
 * Production builds must point to an HTTPS origin.
 */
function resolveApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '').replace(/\/api$/, '');
  if (__DEV__) {
    // Android emulator reaches the host machine via 10.0.2.2.
    return Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';
  }
  // Same-origin deployment for the web build (API served behind the same domain).
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.origin;
  throw new Error('EXPO_PUBLIC_API_URL is not configured');
}

export const API_URL = resolveApiUrl();
export const APP_NAME = 'Agent Mart';
export const APP_SUBTITLE = 'Platform Admin';
export const PAGE_SIZE = 50;
export const REQUEST_TIMEOUT_MS = 30_000;
export const MAX_IMPORT_BYTES = 750 * 1024;
export const MAX_IMPORT_FEATURES = 100;
export const MIN_REASON_LENGTH = 5;
