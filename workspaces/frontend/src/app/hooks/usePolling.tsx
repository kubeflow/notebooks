import { useEffect } from 'react';

export function usePolling(callback: () => void, intervalMs: number): void {
  useEffect(() => {
    const interval = setInterval(callback, intervalMs);
    return () => clearInterval(interval);
  }, [callback, intervalMs]);
}
