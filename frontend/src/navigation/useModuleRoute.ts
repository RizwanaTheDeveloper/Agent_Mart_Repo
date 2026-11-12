import { useCallback, useEffect, useState } from 'react';
import { BackHandler, Platform } from 'react-native';
import { MODULE_KEYS, ModuleKey } from '../api/types';

const isModule = (v: string): v is ModuleKey => (MODULE_KEYS as readonly string[]).includes(v);
const fromHash = (): ModuleKey | null => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const key = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return isModule(key) ? key : null;
};

/**
 * Current module. On web it is mirrored in the URL hash (#/firms) so refresh, bookmarks and the browser
 * back button work; on Android the hardware back button returns to the first allowed module.
 */
export function useModuleRoute(allowed: ModuleKey[]) {
  const fallback = allowed[0] ?? 'overview';
  const [current, setCurrent] = useState<ModuleKey>(() => fromHash() ?? fallback);

  const navigate = useCallback((key: ModuleKey) => {
    setCurrent(key);
    if (Platform.OS === 'web' && window.location.hash !== `#/${key}`) window.location.hash = `/${key}`;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onHash = () => {
      const key = fromHash();
      if (key) setCurrent(key);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (current !== fallback) {
        setCurrent(fallback);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [current, fallback]);

  // Never render a module the role cannot read (e.g. a bookmarked #/admins for a moderator).
  const safe = allowed.includes(current) ? current : fallback;
  return [safe, navigate] as const;
}
