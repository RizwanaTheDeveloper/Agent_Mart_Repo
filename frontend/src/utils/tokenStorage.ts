import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Session token persistence.
 * - iOS / Android: Keychain / Keystore via expo-secure-store (never AsyncStorage).
 * - Web: sessionStorage, so the token dies with the tab and is never shared across tabs.
 * The server enforces the 2-hour absolute expiry regardless.
 */
const KEY = 'agentmart.admin.session';

export async function loadToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return window.sessionStorage.getItem(KEY);
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  try {
    if (Platform.OS === 'web') window.sessionStorage.setItem(KEY, token);
    else await SecureStore.setItemAsync(KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  } catch {
    // Storage unavailable (private browsing etc.) - the session still works in memory.
  }
}

export async function clearToken(): Promise<void> {
  try {
    if (Platform.OS === 'web') window.sessionStorage.removeItem(KEY);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // ignore
  }
}
