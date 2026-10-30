import { useEffect, useState } from 'react';
import { api, errorMessage } from './api';

interface State<T> {
  path: string | null;
  data?: T;
  error?: string;
}

// Loads `path` on mount and whenever it changes. A null path loads nothing.
// `refresh` reloads in place: the current data stays on screen until the new response arrives.
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<State<T>>({ path: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!path) return;
    let active = true;
    api<T>(path).then(
      (data) => {
        if (active) setState({ path, data });
      },
      (err: unknown) => {
        if (active) setState({ path, error: errorMessage(err) });
      },
    );
    return () => {
      active = false;
    };
  }, [path, attempt]);

  const current = state.path === path ? state : undefined;
  return {
    data: current?.data,
    error: current?.error,
    loading: path !== null && !current,
    refresh: () => setAttempt((n) => n + 1),
    retry: () => {
      setState({ path: null });
      setAttempt((n) => n + 1);
    },
  };
}
