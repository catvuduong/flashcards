'use client';

import { useApi } from '@/lib/use-api';

interface Health {
  status: string;
  db: string;
}

export function ApiStatus() {
  const { data, error, loading } = useApi<Health>('/health');

  let text = 'checking...';
  if (error) text = 'api unreachable';
  else if (!loading && data) text = `api ${data.status} / db ${data.db}`;

  return <p data-testid="health">{text}</p>;
}
