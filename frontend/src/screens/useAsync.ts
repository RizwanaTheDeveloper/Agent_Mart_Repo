import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';

/** Minimal data loader with refresh + error state for single-resource screens. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);

  const run = useCallback(
    async (mode: 'load' | 'refresh' = 'load') => {
      const id = ++seq.current;
      if (mode === 'load') setLoading(true);
      else setRefreshing(true);
      try {
        const result = await fn();
        if (id !== seq.current) return;
        setData(result);
        setError(null);
      } catch (e) {
        if (id !== seq.current) return;
        setError(errorMessage(e));
      } finally {
        if (id === seq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  useEffect(() => {
    void run('load');
  }, [run]);

  return { data, setData, error, loading, refreshing, reload: () => run('load'), refresh: () => run('refresh') };
}
