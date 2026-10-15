import { useEffect, useState } from 'react';

type QueryState<T> = { key: string; status: 'loading' | 'success' | 'error'; data?: T; error?: unknown };
// Cleanup rejects stale results even if a transport does not honor abort.
// A key change hides previous data immediately, including during debounce.
export function useQuery<T>(key: string, load: (signal: AbortSignal) => Promise<T>, delay = 0, enabled = true) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<QueryState<T>>({ key: '', status: 'loading' });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const controller = new AbortController();
    setState({ key, status: 'loading' });
    const timer = setTimeout(() => {
      load(controller.signal).then(
        data => { if (active) setState({ key, status: 'success', data }); },
        error => { if (active) setState({ key, status: 'error', error }); },
      );
    }, delay);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
    // The key describes every argument of load. Its function identity is irrelevant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, delay, enabled]);
  return { ...(state.key === key ? state : { key, status: 'loading' as const }), retry: () => setAttempt(value => value + 1) };
}
